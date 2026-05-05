import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  buildProjectsWithStats,
  fetchProfiles,
  fetchProjectMembers,
  fetchProjects,
  fetchTasks,
} from '@/components/tasks/api';
import type { ProfileLite, Project, Task, TasksTab } from '@/components/tasks/types';
import { C } from '@/components/tasks/utils';
import DailyFocusStrip from '@/components/tasks/DailyFocusStrip';
import QuickAddTask from '@/components/tasks/QuickAddTask';
import Overview from '@/components/tasks/Overview';
import ProjectsList from '@/components/tasks/ProjectsList';
import TaskBoard from '@/components/tasks/TaskBoard';
import TaskDrawer from '@/components/tasks/TaskDrawer';
import ProjectPage from '@/components/tasks/ProjectPage';
import ProjectCreateDialog from '@/components/tasks/ProjectCreateDialog';
import { toast } from 'sonner';

export default function Tasks() {
  const { user } = useAuth();
  const role = user?.user_metadata?.role;
  const isAdminOrPM = ['admin', 'pedagogical_manager'].includes(role);

  const tabs: { id: TasksTab; label: string; visible: boolean }[] = [
    { id: 'overview', label: 'סקירה', visible: isAdminOrPM },
    { id: 'board', label: 'לוח עבודה', visible: true },
    { id: 'projects', label: 'פרויקטים', visible: true },
  ];

  const [activeTab, setActiveTab] = useState<TasksTab>(isAdminOrPM ? 'overview' : 'board');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [members, setMembers] = useState<{ project_id: string; user_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [boardProjectFilter, setBoardProjectFilter] = useState<string | null>(null);
  const [boardAssigneeFilter, setBoardAssigneeFilter] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [pj, tk, pf, mb] = await Promise.all([
        fetchProjects(),
        fetchTasks(),
        fetchProfiles(),
        fetchProjectMembers(),
      ]);
      setProjects(pj);
      setTasks(tk);
      setProfiles(pf);
      setMembers(mb);
    } catch (e: any) {
      toast.error('שגיאה בטעינת נתונים: ' + (e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const projectsWithStats = useMemo(
    () => buildProjectsWithStats(projects, tasks, members, profiles),
    [projects, tasks, members, profiles]
  );

  const myTasks = useMemo(
    () => tasks.filter(t => t.assignee_id === user?.id),
    [tasks, user?.id]
  );

  const openProject = openProjectId
    ? projectsWithStats.find(p => p.id === openProjectId) ?? null
    : null;

  const openTask = openTaskId ? tasks.find(t => t.id === openTaskId) ?? null : null;

  const handleProjectOpen = (id: string) => setOpenProjectId(id);
  const handleProjectBoard = (id: string) => {
    setBoardProjectFilter(id);
    setBoardAssigneeFilter(null);
    setActiveTab('board');
    setOpenProjectId(null);
  };
  const handleAssigneeFilter = (id: string) => {
    setBoardAssigneeFilter(id);
    setBoardProjectFilter(null);
    setActiveTab('board');
    setOpenProjectId(null);
  };

  if (!user) return null;

  const tabContent = () => {
    if (openProject) {
      return (
        <ProjectPage
          project={openProject}
          tasks={tasks}
          profiles={profiles}
          myUserId={user.id}
          isAdminOrPM={isAdminOrPM}
          onBack={() => setOpenProjectId(null)}
          onTaskClick={setOpenTaskId}
          onChange={reload}
        />
      );
    }

    if (activeTab === 'overview' && isAdminOrPM) {
      return (
        <Overview
          projects={projectsWithStats}
          rawProjects={projects}
          tasks={tasks}
          profiles={profiles}
          members={members}
          onProjectOpen={handleProjectOpen}
          onProjectBoard={handleProjectBoard}
          onAssigneeFilter={handleAssigneeFilter}
        />
      );
    }
    if (activeTab === 'projects') {
      return (
        <ProjectsList
          projects={projectsWithStats}
          onProjectOpen={handleProjectOpen}
          onProjectBoard={handleProjectBoard}
          onCreateProject={() => setShowCreateProject(true)}
        />
      );
    }
    // board (default)
    return (
      <TaskBoard
        tasks={tasks}
        projects={projects}
        profiles={profiles}
        myUserId={user.id}
        isAdminOrPM={isAdminOrPM}
        onTaskClick={setOpenTaskId}
        onChange={reload}
        onProjectOpen={handleProjectOpen}
        projectFilter={boardProjectFilter}
        assigneeFilter={boardAssigneeFilter}
      />
    );
  };

  return (
    <div dir="rtl" style={{ minHeight: 'calc(100vh - 64px)', background: C.bg }}>
      {/* Sub-nav with "+" */}
      <div
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 4,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, overflowX: 'auto' }}>
          {tabs.filter(t => t.visible).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setOpenProjectId(null);
                setBoardProjectFilter(null);
                setBoardAssigneeFilter(null);
              }}
              style={{
                padding: '12px 18px',
                fontSize: 13,
                fontWeight: activeTab === tab.id && !openProject ? 600 : 400,
                color: activeTab === tab.id && !openProject ? C.accent : C.textSub,
                borderBottom: activeTab === tab.id && !openProject ? `2px solid ${C.accent}` : '2px solid transparent',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                marginBottom: -1,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="hidden md:block" style={{ padding: '8px 0' }}>
          <QuickAddTask
            reporterId={user.id}
            projects={projects}
            profiles={profiles}
            onCreated={reload}
            variant="header"
          />
        </div>
      </div>

      {/* Daily Focus strip */}
      <DailyFocusStrip
        myTasks={myTasks}
        onClickOverdue={() => { setActiveTab('board'); setOpenProjectId(null); }}
        onClickToday={() => { setActiveTab('board'); setOpenProjectId(null); }}
        onClickUrgent={(id) => setOpenTaskId(id)}
      />

      {/* Content */}
      <div>
        {loading && projects.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.textSub }}>טוען...</div>
        ) : (
          tabContent()
        )}
      </div>

      {/* Mobile FAB */}
      <div className="md:hidden">
        <QuickAddTask
          reporterId={user.id}
          projects={projects}
          profiles={profiles}
          onCreated={reload}
          variant="fab"
        />
      </div>

      {/* Drawers / dialogs */}
      <TaskDrawer
        task={openTask}
        projects={projects}
        profiles={profiles}
        canEdit={isAdminOrPM || openTask?.assignee_id === user.id || openTask?.reporter_id === user.id}
        currentUserId={user.id}
        isAdminOrPM={isAdminOrPM}
        onClose={() => setOpenTaskId(null)}
        onChange={reload}
      />

      <ProjectCreateDialog
        open={showCreateProject}
        ownerId={user.id}
        onClose={() => setShowCreateProject(false)}
        onCreated={reload}
      />
    </div>
  );
}

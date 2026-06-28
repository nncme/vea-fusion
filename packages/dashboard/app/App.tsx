import { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import type { Task, TaskDetail } from "@fusion/core";
import { Header, useViewportMode } from "./components/Header";
import { Board } from "./components/Board";
import { ListView } from "./components/ListView";
import { ProjectOverview } from "./components/ProjectOverview";
import { MissionManager } from "./components/MissionManager";
import { MailboxView } from "./components/MailboxView";
import { PageErrorBoundary } from "./components/ErrorBoundary";
import { AppModals } from "./components/AppModals";
import { BackendConnectionErrorPage } from "./components/BackendConnectionErrorPage";
import { DashboardLoader, type DashboardLoaderStage } from "./components/DashboardLoader";
import { ExecutorStatusBar } from "./components/ExecutorStatusBar";
import { SessionNotificationBanner } from "./components/SessionNotificationBanner";
import { SetupWarningBanner } from "./components/SetupWarningBanner";
import { OnboardingResumeCard } from "./components/OnboardingResumeCard";
import { PostOnboardingRecommendations } from "./components/PostOnboardingRecommendations";
import {
  isOnboardingCompleted,
  isOnboardingResumable,
  isPostOnboardingDismissed,
} from "./components/model-onboarding-state";
import type { SectionId } from "./components/SettingsModal";
import { MobileNavBar } from "./components/MobileNavBar";
import { QuickChatFAB } from "./components/QuickChatFAB";
import { TopBar, type TopBarTab } from "./components/TopBar";
import { ActionTicker } from "./components/ActionTicker";
import { SpotlightOverlay } from "./components/SpotlightOverlay";
import { DashboardHome } from "./components/DashboardHome";
import { LlmOpsView } from "./components/LlmOpsView";
import { ToastContainer } from "./components/ToastContainer";
import { usePendingDecisions } from "./hooks/usePendingDecisions";
import { useTokensPerHour } from "./hooks/useTokensPerHour";
import { useRuntimeHealth } from "./hooks/useRuntimeHealth";
import { useActionTickerItems } from "./hooks/useActionTickerItems";
import { useVeaRoster } from "./hooks/useVeaRoster";
import { useBackgroundSessions } from "./hooks/useBackgroundSessions";
import { useTasks } from "./hooks/useTasks";
import { useProjects } from "./hooks/useProjects";
import { useNodes } from "./hooks/useNodes";
import { useCurrentProject } from "./hooks/useCurrentProject";
import { ToastProvider, useToast } from "./hooks/useToast";
import { useTheme } from "./hooks/useTheme";
import { useModalManager } from "./hooks/useModalManager";
import { useAppSettings } from "./hooks/useAppSettings";
import { useDeepLink } from "./hooks/useDeepLink";
import { useFavorites } from "./hooks/useFavorites";
import { useAuthOnboarding } from "./hooks/useAuthOnboarding";
import { useSetupReadiness } from "./hooks/useSetupReadiness";
import { useViewState, type TaskView } from "./hooks/useViewState";
import { useProjectActions } from "./hooks/useProjectActions";
import { useTaskHandlers } from "./hooks/useTaskHandlers";
import { useRemoteNodeData } from "./hooks/useRemoteNodeData";
import { useRemoteNodeEvents } from "./hooks/useRemoteNodeEvents";
import { NodeProvider, useNodeContext } from "./context/NodeContext";
import type { AiSessionSummary } from "./api";
import { fetchUnreadCount, reportDashboardPerf } from "./api";
import { getScopedItem, setScopedItem } from "./utils/projectStorage";
import { subscribeSse } from "./sse-bus";
import { AUTH_TOKEN_RECOVERY_REQUIRED_EVENT } from "./auth";
import { AuthTokenRecoveryDialog } from "./components/AuthTokenRecoveryDialog";

// ChatView's CSS is imported eagerly so the styles bundle into the main
// CSS file. Without this, the lazy ChatView JS chunk loaded its own CSS
// link asynchronously, producing a brief flash of unstyled chat UI on
// first render.
import "./components/ChatView.css";

const AgentsView = lazy(() => import("./components/AgentsView").then((m) => ({ default: m.AgentsView })));
const DocumentsView = lazy(() => import("./components/DocumentsView").then((m) => ({ default: m.DocumentsView })));
const InsightsView = lazy(() => import("./components/InsightsView").then((m) => ({ default: m.InsightsView })));
const NodesView = lazy(() => import("./components/NodesView").then((m) => ({ default: m.NodesView })));
const ChatView = lazy(() => import("./components/ChatView").then((m) => ({ default: m.ChatView })));
const RoadmapsView = lazy(() => import("./components/RoadmapsView").then((m) => ({ default: m.RoadmapsView })));
const SkillsView = lazy(() => import("./components/SkillsView").then((m) => ({ default: m.SkillsView })));
const MemoryView = lazy(() => import("./components/MemoryView").then((m) => ({ default: m.MemoryView })));
const DevServerView = lazy(() => import("./components/DevServerView").then((m) => ({ default: m.DevServerView })));
const TodoView = lazy(() => import("./components/TodoView").then((m) => ({ default: m.TodoView })));

// Warm lazy chunks during browser idle so first navigation to each view is
// instant. Each chunk is ~10–80 kB; total prefetch finishes well under a
// second on broadband. Uses requestIdleCallback so it never blocks render.
function prefetchLazyViews() {
  const idle =
    (typeof window !== "undefined" && (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback) ||
    ((cb: () => void) => setTimeout(cb, 200));
  idle(() => {
    void import("./components/AgentsView");
    void import("./components/DocumentsView");
    void import("./components/InsightsView");
    void import("./components/NodesView");
    void import("./components/ChatView");
    void import("./components/RoadmapsView");
    void import("./components/SkillsView");
    void import("./components/MemoryView");
    void import("./components/DevServerView");
    void import("./components/TodoView");
  });
}

const SETUP_WARNING_DISMISSED_KEY = "kb-setup-warning-dismissed";

// TODO(live-binding): Option E TopBar Fabric badge — stub count until the
// Fabric approval-queue live binding lands (DESIGN.md §7, deferred wave).
const FABRIC_PENDING_COUNT_STUB = 5;

function AppInner() {
  const { toasts, addToast, removeToast } = useToast();
  const isElectron = typeof window !== "undefined" && Boolean((window as Window & { electronAPI?: unknown }).electronAPI);

  // Warm lazy view chunks during browser idle so first navigation is instant.
  useEffect(() => {
    prefetchLazyViews();
  }, []);

  // Project management hooks - MUST be called before any conditional logic
  const { projects, loading: projectsLoading, error: projectsError, refresh: refreshProjects } = useProjects();
  const { nodes } = useNodes();

  // Node context for local/remote node switching - must be called before useCurrentProject
  const { currentNode, currentNodeId, isRemote, setCurrentNode, clearCurrentNode } = useNodeContext();

  // Current project with node-aware persistence
  const { currentProject, setCurrentProject, clearCurrentProject, loading: currentProjectLoading } = useCurrentProject(projects, { nodeId: currentNodeId });

  const {
    hasAiProvider,
    hasGithub,
    loading: setupReadinessLoading,
    hasWarnings,
  } = useSetupReadiness(currentProject?.id);
  
  // Sync node context with useNodes() results:
  // - Resolve saved node ID to full NodeConfig when nodes list loads
  // - Fall back to local if selected node is missing or deleted
  useEffect(() => {
    // If we have a saved node ID but no currentNode yet (initial hydration),
    // resolve it from the nodes list
    if (currentNodeId && !currentNode && nodes.length > 0) {
      const foundNode = nodes.find((n) => n.id === currentNodeId);
      if (foundNode) {
        setCurrentNode(foundNode);
        return;
      }
    }
    
    // If we have a currentNode but the saved ID no longer exists in nodes list,
    // fall back to local view
    if (currentNodeId && nodes.length > 0) {
      const nodeExists = nodes.some((n) => n.id === currentNodeId);
      if (!nodeExists) {
        // Selected node was deleted or unregistered - fall back to local
        clearCurrentNode();
      }
    }
  }, [currentNodeId, currentNode, nodes, setCurrentNode, clearCurrentNode]);
  
  // Search query state - must be defined before useTasks
  const [searchQuery, setSearchQuery] = useState("");
  
  // Remote node data and events when in remote mode (pass searchQuery for server-side filtering)
  const remoteData = useRemoteNodeData(currentNodeId, { projectId: currentProject?.id, searchQuery: searchQuery || undefined });
  useRemoteNodeEvents(currentNodeId);

  // Use remote data when in remote mode, local data otherwise
  const effectiveProjects = isRemote && remoteData.projects.length > 0 ? remoteData.projects : projects;
  
  // Theme management - required before useViewState
  const { themeMode, colorTheme, setThemeMode, setColorTheme } = useTheme();

  // Background AI sessions - required before useModalManager
  const { sessions: bgSessions, generating: bgGenerating, needsInput: bgNeedsInput, planningSessions: bgPlanningSessions, dismissSession: bgDismiss } = useBackgroundSessions(currentProject?.id);
  const sessionsNeedingInput = bgSessions.filter(
    (session) => session.status === "awaiting_input" || session.status === "error"
  );

  // Modal state/handlers - required before useViewState
  const modalManager = useModalManager({
    projectId: currentProject?.id,
    planningSessions: bgPlanningSessions,
  });

  // View state must be defined before useTasks since useTasks depends on taskView for SSE gating
  const { viewMode, setViewMode, taskView, handleChangeTaskView } = useViewState({
    projectsLoading,
    projectsError,
    currentProjectLoading,
    currentProject,
    projectsLength: projects.length,
    setupWizardOpen: modalManager.setupWizardOpen,
    openSetupWizard: modalManager.openSetupWizard,
    themeMode,
    setThemeMode,
  });

  const handleTaskViewChange = useCallback((newView: TaskView) => {
    if (newView === "missions") {
      setMissionResumeSessionId(undefined);
      setMissionTargetId(undefined);
      setMilestoneSliceResumeSessionId(undefined);
    }
    handleChangeTaskView(newView);
  }, [handleChangeTaskView]);

  // Tasks hook with project context and search query
  // SSE is only enabled for board/list views to free connection slots for mission detail fetches
  const taskSseEnabled = taskView === "board" || taskView === "list";
  const { tasks, createTask, moveTask, pauseTask, deleteTask, mergeTask, retryTask, updateTask, duplicateTask, archiveTask, unarchiveTask, archiveAllDone, loadArchivedTasks, lastFetchTimeMs } = useTasks(
    {
      ...(currentProject ? { projectId: currentProject.id } : {}),
      searchQuery: searchQuery || undefined,
      sseEnabled: taskSseEnabled,
    }
  );

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const mountTimeRef = useRef(performance.now());
  const projectsReadyLoggedRef = useRef(false);
  const projectReadyLoggedRef = useRef(false);

  const loadingStage = useMemo<DashboardLoaderStage>(() => {
    if (projectsLoading) return "projects";
    if (currentProjectLoading) return "project";
    return "tasks";
  }, [projectsLoading, currentProjectLoading]);

  useEffect(() => {
    if (!projectsLoading && !projectsReadyLoggedRef.current) {
      projectsReadyLoggedRef.current = true;
      const msg = `projects loaded at ${Math.round(performance.now() - mountTimeRef.current)}ms from mount`;
      console.log(`[App] ${msg}`);
      reportDashboardPerf("[App]", msg);
    }
    if (!currentProjectLoading && !projectReadyLoggedRef.current) {
      projectReadyLoggedRef.current = true;
      const msg = `current-project resolved at ${Math.round(performance.now() - mountTimeRef.current)}ms from mount`;
      console.log(`[App] ${msg}`);
      reportDashboardPerf("[App]", msg);
    }
  }, [projectsLoading, currentProjectLoading]);

  useEffect(() => {
    if (initialLoadComplete) {
      return;
    }

    if (projectsLoading || currentProjectLoading) {
      return;
    }

    const settleStart = performance.now();
    const settleTimer = window.setTimeout(() => {
      const msg = `dashboard ready at ${Math.round(performance.now() - mountTimeRef.current)}ms from mount (settle delay=${Math.round(performance.now() - settleStart)}ms)`;
      console.log(`[App] ${msg}`);
      reportDashboardPerf("[App]", msg);
      setInitialLoadComplete(true);
    }, 200);

    return () => {
      window.clearTimeout(settleTimer);
    };
  }, [initialLoadComplete, projectsLoading, currentProjectLoading]);

  const viewportMode = useViewportMode();
  const isMobile = viewportMode === "mobile";

  // App-level mailbox unread count state (used for header/mobile nav badges)
  const [mailboxUnreadCount, setMailboxUnreadCount] = useState(0);

  const refreshMailboxUnreadCount = useCallback(() => {
    fetchUnreadCount(currentProject?.id)
      .then((data: { unreadCount: number }) => {
        setMailboxUnreadCount(data.unreadCount);
      })
      .catch((err) => {
        console.warn("[App] Failed to fetch mailbox unread count:", err);
      });
  }, [currentProject?.id]);

  // Initial fetch + live updates from mailbox SSE events.
  useEffect(() => {
    refreshMailboxUnreadCount();

    const params = new URLSearchParams();
    if (currentProject?.id) {
      params.set("projectId", currentProject.id);
    }
    const query = params.size > 0 ? `?${params.toString()}` : "";

    return subscribeSse(`/api/events${query}`, {
      events: {
        "message:sent": refreshMailboxUnreadCount,
        "message:received": refreshMailboxUnreadCount,
        "message:read": refreshMailboxUnreadCount,
        "message:deleted": refreshMailboxUnreadCount,
      },
    });
  }, [currentProject?.id, refreshMailboxUnreadCount]);

  // Nodes management is an overlay view (not a modal), so it stays local to App.
  const [nodesOpen, setNodesOpen] = useState(false);
  const [retryingProjects, setRetryingProjects] = useState(false);
  const [missionResumeSessionId, setMissionResumeSessionId] = useState<string | undefined>(undefined);
  const [missionTargetId, setMissionTargetId] = useState<string | undefined>(undefined);

  // ── C.4 live-data hooks (Phase B/C) — feed the Option E homepage cards +
  // ActionTicker with real Fabric / runtime data, replacing the prior stubs.
  // Each hook polls every 30s and degrades gracefully to its own fallback.
  const pendingDecisions = usePendingDecisions();
  const tokensPerHour = useTokensPerHour();
  const runtimeHealth = useRuntimeHealth();
  const actionTickerItems = useActionTickerItems();
  const veaRoster = useVeaRoster(); // 8-agent roster from identities.json (B3/B4)
  const [llmOpsOpen, setLlmOpsOpen] = useState(false); // LG-4: "LLM Ops" tab
  const [milestoneSliceResumeSessionId, setMilestoneSliceResumeSessionId] = useState<string | undefined>(undefined);
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [authTokenRecoveryOpen, setAuthTokenRecoveryOpen] = useState(false);

  // --- Option E (DESIGN.md) -------------------------------------------------
  // The Option E composite homepage is an ADDITIVE landing surface. The
  // TopBar, ActionTicker and ⌘K SpotlightOverlay frame the ENTIRE app and
  // persist across every existing Fusion view; only the homepage *body*
  // (DashboardHome — the 3 cards) is conditional on `optionEHome`.
  //
  // optionEHome=true  → render DashboardHome (the new default landing)
  // optionEHome=false → render the pre-existing Fusion app (Header + views),
  //                     completely unchanged in behaviour.
  // Handlers that depend on useProjectActions/useViewState are defined
  // further down (handleTopBarTab) — these are just the raw state cells.
  const [optionEHome, setOptionEHome] = useState(true);
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  const openSpotlight = useCallback(() => setSpotlightOpen(true), []);
  const closeSpotlight = useCallback(() => setSpotlightOpen(false), []);

  // App-wide ⌘K / Ctrl+K summon. SpotlightOverlay is mounted in controlled
  // mode (its `open` prop is owned here), so its own hotkey listener only
  // *closes* it — the *open* path lives at the app level so ⌘K works from
  // the Option E homepage and from every existing Fusion view alike.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSpotlightOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const [setupWarningDismissed, setSetupWarningDismissed] = useState(
    () => getScopedItem(SETUP_WARNING_DISMISSED_KEY, currentProject?.id) === "true",
  );

  useEffect(() => {
    setSetupWarningDismissed(
      getScopedItem(SETUP_WARNING_DISMISSED_KEY, currentProject?.id) === "true",
    );
  }, [currentProject?.id]);

  useEffect(() => {
    const handleDaemonAuthFailure = () => {
      setAuthTokenRecoveryOpen(true);
    };

    window.addEventListener(AUTH_TOKEN_RECOVERY_REQUIRED_EVENT, handleDaemonAuthFailure);
    return () => {
      window.removeEventListener(AUTH_TOKEN_RECOVERY_REQUIRED_EVENT, handleDaemonAuthFailure);
    };
  }, []);

  const handleDismissSetupWarning = useCallback(() => {
    setScopedItem(SETUP_WARNING_DISMISSED_KEY, "true", currentProject?.id);
    setSetupWarningDismissed(true);
  }, [currentProject?.id]);

  // Settings state
  const {
    maxConcurrent,
    autoMerge,
    globalPaused,
    enginePaused,
    taskStuckTimeoutMs,
    showQuickChatFAB,
    prAuthAvailable,
    experimentalFeatures,
    insightsEnabled,
    roadmapEnabled,
    memoryEnabled,
    devServerEnabled,
    toggleAutoMerge,
    toggleGlobalPause,
    toggleEnginePause,
    refresh: refreshAppSettings,
  } = useAppSettings(currentProject?.id);

  const skillsEnabled = experimentalFeatures.skillsView === true;
  const nodesEnabled = experimentalFeatures.nodesView === true;
  const agentsEnabled = true;

  // Redirect to board if feature-gated views are disabled.
  // Only run after settings have been loaded (experimentalFeatures is non-empty)
  useEffect(() => {
    if (Object.keys(experimentalFeatures).length === 0) return;
    if (taskView === "insights" && !insightsEnabled) {
      handleChangeTaskView("board");
    }
    if (taskView === "roadmaps" && !roadmapEnabled) {
      handleChangeTaskView("board");
    }
    if (taskView === "agents" && !agentsEnabled) {
      handleChangeTaskView("board");
    }
    if (taskView === "memory" && !memoryEnabled) {
      handleChangeTaskView("board");
    }
    if ((taskView === "devserver" || taskView === "dev-server") && !devServerEnabled) {
      handleChangeTaskView("board");
    }
  }, [taskView, insightsEnabled, roadmapEnabled, experimentalFeatures, handleChangeTaskView, agentsEnabled, memoryEnabled, devServerEnabled]);

  // Auto-close nodes overlay if feature flag is toggled off while overlay is open
  useEffect(() => {
    if (nodesOpen && !nodesEnabled) {
      setNodesOpen(false);
    }
  }, [nodesOpen, nodesEnabled]);
  const {
    availableModels,
    favoriteProviders,
    favoriteModels,
    toggleFavoriteProvider,
    toggleFavoriteModel,
  } = useFavorites();

  // Auth and onboarding bootstrap logic extracted to a dedicated hook.
  useAuthOnboarding({
    projectId: currentProject?.id,
    openModelOnboarding: modalManager.openModelOnboarding,
    openSettings: modalManager.openSettings,
  });

  const {
    handleSelectProject,
    handleViewAllProjects,
    handleOpenSettings,
    handleAddProject,
    handleSetupComplete,
    handleModelOnboardingComplete,
    handlePauseProject,
    handleResumeProject,
    handleRemoveProject,
    handleToggleFavorite,
    handleToggleModelFavorite,
  } = useProjectActions({
    setCurrentProject,
    clearCurrentProject,
    setViewMode,
    currentProject,
    refreshProjects,
    toggleFavoriteProvider,
    toggleFavoriteModel,
    addToast,
    openSettings: modalManager.openSettings,
    openSetupWizard: modalManager.openSetupWizard,
    closeSetupWizard: modalManager.closeSetupWizard,
    closeModelOnboarding: modalManager.closeModelOnboarding,
  });

  // --- Option E TopBar router (depends on useProjectActions/useViewState) ---
  // The TopBar's active tab is derived: "dashboard" while on the Option E
  // homepage, otherwise it reflects whichever existing view is showing.
  const topBarActiveTab: TopBarTab = llmOpsOpen
    ? "llm-ops"
    : optionEHome
    ? "dashboard"
    : taskView === "agents"
      ? "agents"
      : taskView === "memory"
        ? "kg"
        : "dashboard";

  // Primary-nav router. Every tab routes to a pre-existing surface; nothing
  // is replaced. "decisions" summons the ⌘K spotlight; "settings" opens the
  // existing Settings modal — both leave the underlying view intact.
  const handleTopBarTab = useCallback(
    (tab: TopBarTab) => {
      switch (tab) {
        case "dashboard":
          setLlmOpsOpen(false);
          setOptionEHome(true);
          return;
        case "agents":
          setLlmOpsOpen(false);
          setOptionEHome(false);
          handleTaskViewChange("agents");
          return;
        case "kg":
          // Knowledge Graph maps to the existing Memory view.
          setLlmOpsOpen(false);
          setOptionEHome(false);
          handleTaskViewChange("memory");
          return;
        case "decisions":
          // Decisions = the Fabric approval queue → ⌘K spotlight.
          openSpotlight();
          return;
        case "llm-ops":
          // LG-4: native LLM Ops console (reference surfaces); usage is on the home.
          setOptionEHome(false);
          setLlmOpsOpen(true);
          return;
        case "settings":
          handleOpenSettings();
          return;
        default:
          return;
      }
    },
    [handleTaskViewChange, openSpotlight, handleOpenSettings],
  );

  const { handleDetailClose } = useDeepLink({
    projectId: currentProject?.id,
    projects,
    projectsLoading,
    currentProject,
    setCurrentProject,
    addToast,
    openTaskDetail: modalManager.openDetailTask,
    closeTaskDetail: modalManager.closeDetailTask,
  });

  // Task handlers
  const {
    handleBoardQuickCreate,
    handleModalCreate,
    handlePlanningTaskCreated,
    handlePlanningTasksCreated,
    handleSubtaskTasksCreated,
    handleGitHubImport,
  } = useTaskHandlers({
    createTask,
    onPlanningTaskCreated: modalManager.onPlanningTaskCreated,
    onPlanningTasksCreated: modalManager.onPlanningTasksCreated,
    onSubtaskTasksCreated: modalManager.onSubtaskTasksCreated,
    addToast,
  });

  const handleOpenDetailWithTab = useCallback((task: Task | TaskDetail, initialTab: "changes") => {
    if (initialTab === "changes") {
      modalManager.openDetailWithChangesTab(task);
      return;
    }
    modalManager.openDetailTask(task, initialTab);
  }, [modalManager]);

  const handleOpenNodes = useCallback(() => {
    if (!nodesEnabled) return;
    setNodesOpen((prev) => !prev);
  }, [nodesEnabled]);

  const handleOpenProjectDirectory = useCallback(() => {
    modalManager.setFileWorkspace("project");
    modalManager.openFiles();
  }, [modalManager]);

  const handleRetryProjects = useCallback(async () => {
    setRetryingProjects(true);
    try {
      await refreshProjects();
    } finally {
      setRetryingProjects(false);
    }
  }, [refreshProjects]);

  const handleOpenMission = useCallback((missionId: string) => {
    setMissionTargetId(missionId);
    setMissionResumeSessionId(undefined);
    handleChangeTaskView("missions");
  }, [handleChangeTaskView]);

  const handleOpenBackgroundSession = useCallback((session: AiSessionSummary) => {
    if (session.type === "planning") {
      modalManager.openPlanningWithSession(session.id);
    } else if (session.type === "subtask") {
      modalManager.openSubtaskWithSession(session.id);
    } else if (session.type === "mission_interview") {
      setMissionTargetId(undefined);
      setMissionResumeSessionId(session.id);
      setMilestoneSliceResumeSessionId(undefined);
      handleChangeTaskView("missions");
    } else if (session.type === "milestone_interview" || session.type === "slice_interview") {
      // For milestone/slice interviews, we need to fetch the session to get the target ID
      // Then navigate to missions view with the resume session ID
      setMissionResumeSessionId(undefined);
      setMissionTargetId(undefined);
      setMilestoneSliceResumeSessionId(session.id);
      handleChangeTaskView("missions");
    }
  }, [handleChangeTaskView, modalManager]);

  const handleDismissAllNeedingInputSessions = useCallback(() => {
    for (const session of sessionsNeedingInput) {
      bgDismiss(session.id);
    }
  }, [bgDismiss, sessionsNeedingInput]);

  const showBackendConnectionErrorPage =
    !projectsLoading &&
    !currentProjectLoading &&
    projects.length === 0 &&
    !currentProject &&
    Boolean(projectsError);

  // Render main content based on view mode
  const renderMainContent = () => {
    if (showBackendConnectionErrorPage) {
      return (
        <BackendConnectionErrorPage
          errorMessage={projectsError ?? "Failed to fetch projects"}
          isRetrying={retryingProjects}
          onRetry={handleRetryProjects}
        />
      );
    }

    if (nodesOpen) {
      return (
        <div className="nodes-management-overlay">
          <PageErrorBoundary>
            <Suspense fallback={null}>
              <NodesView addToast={addToast} onClose={() => setNodesOpen(false)} />
            </Suspense>
          </PageErrorBoundary>
        </div>
      );
    }

    if (viewMode === "overview") {
      return (
        <PageErrorBoundary>
          <ProjectOverview
            projects={projects}
            loading={projectsLoading}
            onSelectProject={handleSelectProject}
            onAddProject={handleAddProject}
            onPauseProject={handlePauseProject}
            onResumeProject={handleResumeProject}
            onRemoveProject={handleRemoveProject}
            nodes={nodes}
          />
        </PageErrorBoundary>
      );
    }

    // Project view
    if (taskView === "skills") {
      if (!skillsEnabled) {
        // Redirect to board if skills view is not enabled
        handleChangeTaskView("board");
        return null;
      }
      return (
        <PageErrorBoundary>
          <Suspense fallback={null}>
            <SkillsView
              addToast={addToast}
              projectId={currentProject?.id}
              onClose={() => handleChangeTaskView("board")}
            />
          </Suspense>
        </PageErrorBoundary>
      );
    }

    if (taskView === "chat") {
      return (
        <PageErrorBoundary>
          <Suspense fallback={null}>
            <ChatView addToast={addToast} projectId={currentProject?.id} />
          </Suspense>
        </PageErrorBoundary>
      );
    }

    if (taskView === "mailbox") {
      return (
        <PageErrorBoundary>
          <MailboxView
            projectId={currentProject?.id}
            addToast={addToast}
            onUnreadCountChange={setMailboxUnreadCount}
          />
        </PageErrorBoundary>
      );
    }

    if (taskView === "roadmaps") {
      return (
        <PageErrorBoundary>
          <Suspense fallback={null}>
            <RoadmapsView addToast={addToast} projectId={currentProject?.id} />
          </Suspense>
        </PageErrorBoundary>
      );
    }

    if (taskView === "missions") {
      return (
        <PageErrorBoundary>
          <MissionManager
            isInline={true}
            isOpen={true}
            onClose={() => {
              setMissionTargetId(undefined);
              setMissionResumeSessionId(undefined);
              setMilestoneSliceResumeSessionId(undefined);
              handleChangeTaskView("board");
            }}
            addToast={addToast}
            projectId={currentProject?.id}
            onSelectTask={(taskId) => {
              const task = tasks.find((t) => t.id === taskId);
              if (task) modalManager.openDetailTask(task as TaskDetail);
            }}
            availableTasks={tasks.map((t) => ({ id: t.id, title: t.title }))}
            resumeSessionId={missionResumeSessionId}
            targetMissionId={missionTargetId}
            milestoneSliceResumeSessionId={milestoneSliceResumeSessionId}
            onMilestoneSliceResumeFetchError={() => setMilestoneSliceResumeSessionId(undefined)}
          />
        </PageErrorBoundary>
      );
    }

    if (taskView === "agents" && agentsEnabled) {
      return (
        <PageErrorBoundary>
          <Suspense fallback={null}>
            <AgentsView addToast={addToast} projectId={currentProject?.id} />
          </Suspense>
        </PageErrorBoundary>
      );
    }

    if (taskView === "documents") {
      return (
        <PageErrorBoundary>
          <Suspense fallback={null}>
            <DocumentsView
              projectId={currentProject?.id}
              addToast={addToast}
              onOpenDetail={modalManager.openDetailTask}
            />
          </Suspense>
        </PageErrorBoundary>
      );
    }

    if (taskView === "insights") {
      return (
        <PageErrorBoundary>
          <Suspense fallback={null}>
            <InsightsView
              projectId={currentProject?.id}
              addToast={addToast}
              onClose={() => handleChangeTaskView("board")}
            />
          </Suspense>
        </PageErrorBoundary>
      );
    }

    if (taskView === "memory") {
      return (
        <PageErrorBoundary>
          <Suspense fallback={null}>
            <MemoryView addToast={addToast} projectId={currentProject?.id} />
          </Suspense>
        </PageErrorBoundary>
      );
    }

    if (taskView === "todos") {
      return (
        <PageErrorBoundary>
          <Suspense fallback={null}>
            <TodoView addToast={addToast} projectId={currentProject?.id} />
          </Suspense>
        </PageErrorBoundary>
      );
    }

    if (taskView === "devserver" || taskView === "dev-server") {
      return (
        <PageErrorBoundary>
          <Suspense fallback={null}>
            <DevServerView addToast={addToast} projectId={currentProject?.id} />
          </Suspense>
        </PageErrorBoundary>
      );
    }

    if (taskView === "board") {
      return (
        <PageErrorBoundary>
          <Board
            tasks={isRemote && remoteData.tasks.length > 0 ? remoteData.tasks : tasks}
            projectId={currentProject?.id}
            maxConcurrent={maxConcurrent}
            onMoveTask={moveTask}
            onPauseTask={pauseTask}
            onOpenDetail={modalManager.openDetailTask}
            addToast={addToast}
            onQuickCreate={handleBoardQuickCreate}
            onNewTask={modalManager.openNewTask}
            onPlanningMode={modalManager.openPlanningWithInitialPlan}
            onSubtaskBreakdown={modalManager.openSubtaskBreakdown}
            autoMerge={autoMerge}
            onToggleAutoMerge={toggleAutoMerge}
            globalPaused={globalPaused}
            onUpdateTask={updateTask}
            onArchiveTask={archiveTask}
            onUnarchiveTask={unarchiveTask}
            onDeleteTask={deleteTask}
            onArchiveAllDone={archiveAllDone}
            onLoadArchivedTasks={loadArchivedTasks}
            searchQuery={searchQuery}
            availableModels={availableModels}
            onOpenDetailWithTab={handleOpenDetailWithTab}
            favoriteProviders={favoriteProviders}
            favoriteModels={favoriteModels}
            onToggleFavorite={handleToggleFavorite}
            onToggleModelFavorite={handleToggleModelFavorite}
            taskStuckTimeoutMs={taskStuckTimeoutMs}
            onOpenMission={handleOpenMission}
            lastFetchTimeMs={lastFetchTimeMs}
          />
        </PageErrorBoundary>
      );
    }

    // List view
    return (
      <PageErrorBoundary>
        <ListView
          tasks={isRemote && remoteData.tasks.length > 0 ? remoteData.tasks : tasks}
          projectId={currentProject?.id}
          onMoveTask={moveTask}
          onOpenDetail={modalManager.openDetailTask}
          addToast={addToast}
          globalPaused={globalPaused}
          onNewTask={modalManager.openNewTask}
          onQuickCreate={handleBoardQuickCreate}
          onPlanningMode={modalManager.openPlanningWithInitialPlan}
          onSubtaskBreakdown={modalManager.openSubtaskBreakdown}
          availableModels={availableModels}
          favoriteProviders={favoriteProviders}
          favoriteModels={favoriteModels}
          onToggleFavorite={handleToggleFavorite}
          onToggleModelFavorite={handleToggleModelFavorite}
          taskStuckTimeoutMs={taskStuckTimeoutMs}
          searchQuery={searchQuery}
          lastFetchTimeMs={lastFetchTimeMs}
        />
      </PageErrorBoundary>
    );
  };

  if (!initialLoadComplete) {
    return (
      <>
        <DashboardLoader stage={loadingStage} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  const showOnboardingResumeCard = !modalManager.modelOnboardingOpen && isOnboardingResumable();
  const showPostOnboardingRecommendations =
    !modalManager.modelOnboardingOpen &&
    !showOnboardingResumeCard &&
    isOnboardingCompleted() &&
    !isPostOnboardingDismissed();

  // Option E ambient frame — TopBar + ActionTicker + ⌘K SpotlightOverlay.
  // These persist across the homepage AND every existing Fusion view.
  // Stub data only for now (DESIGN.md §7 — live binding is a deferred wave).
  const optionEFrame = (
    <>
      <TopBar
        activeTab={topBarActiveTab}
        onTabChange={handleTopBarTab}
        fabricPendingCount={pendingDecisions?.count ?? FABRIC_PENDING_COUNT_STUB}
        onSummonFabric={openSpotlight}
        tailnetIp="100.93.222.17"
        operatorInitials="CN"
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />
      <ActionTicker items={actionTickerItems} onItemActivate={openSpotlight} />
    </>
  );
  const optionESpotlight = (
    <SpotlightOverlay
      open={spotlightOpen}
      onClose={closeSpotlight}
      onSelect={closeSpotlight}
      onOpenFabric={closeSpotlight}
    />
  );
  // Always-on global overlays — modals/dialogs that must be mountable from
  // ANY surface, not gated behind a view. AuthTokenRecoveryDialog surfaces
  // an expired-token recovery flow triggered by a window event, so it must
  // render on the Option E homepage AND the legacy branch alike. Defined
  // once here and reused in both branches (same pattern as optionEFrame).
  const optionEGlobalOverlays = (
    <>
      <AuthTokenRecoveryDialog open={authTokenRecoveryOpen} />
    </>
  );

  // --- LG-4: "LLM Ops" tab — native console reference surfaces (ambient frame) --
  if (llmOpsOpen) {
    return (
      <>
        {optionEFrame}
        <LlmOpsView />
        {optionESpotlight}
        {optionEGlobalOverlays}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  // --- Option E homepage (the new additive default landing) ----------------
  if (optionEHome) {
    return (
      <>
        {optionEFrame}
        {/* C.4 live-binding (Phase B/C, 2026-06-28): pending/tokens/runtime now
            flow from live Fabric/runtime hooks — no longer stubs. */}
        <DashboardHome
          pending={pendingDecisions}
          tokens={tokensPerHour}
          runtime={runtimeHealth}
          roster={veaRoster}
          onSummonSpotlight={openSpotlight}
        />
        {optionESpotlight}
        {optionEGlobalOverlays}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  return (
    <>
      {optionEFrame}
      {/* Option E: the legacy Header renders as a slimmed secondary contextual
          toolbar BENEATH the TopBar (variant="subbar") — its brand wordmark is
          suppressed so the TopBar is the sole header-level brand/nav surface.
          All icon-bar / contextual controls remain intact.

          Gating (C.1.3, corrects b18a5906): the subbar IS the Kanban board's
          toolbar — its grid/list toggle + search belong to the task board.
          b18a5906 gated on `viewMode === "project" && currentProject`, but a
          workspace ("vea") is also active on the Agents and Knowledge Graph
          tabs, so that condition stayed TRUE there and the subbar still
          stacked under the TopBar (the double-header bug). The TopBar tab is
          derived from `taskView` (agents→Agents, memory→Knowledge Graph,
          board/list→Kanban). So additionally require the Kanban board view
          itself — `taskView === "board" || taskView === "list"` — which is
          FALSE on agents/memory and therefore correctly suppresses the subbar
          on the Agents / Knowledge Graph tabs (and behind the
          Decisions/Settings modals, which leave the underlying view intact). */}
      {viewMode === "project" &&
        currentProject &&
        (taskView === "board" || taskView === "list") && (
      <Header
        variant="subbar"
        isElectron={isElectron}
        onOpenSettings={handleOpenSettings}
        onOpenGitHubImport={modalManager.openGitHubImport}
        onOpenPlanning={modalManager.openPlanning}
        onResumePlanning={modalManager.resumePlanning}
        activePlanningSessionCount={bgPlanningSessions.length}
        onOpenUsage={modalManager.openUsage}
        onOpenActivityLog={modalManager.openActivityLog}
        onOpenMailbox={() => handleTaskViewChange("mailbox")}
        mailboxUnreadCount={mailboxUnreadCount}
        onOpenSchedules={modalManager.openSchedules}
        onOpenGitManager={modalManager.openGitManager}
        onOpenNodes={handleOpenNodes}
        showNodesButton={nodesEnabled}
        onOpenWorkflowSteps={modalManager.openWorkflowSteps}
        onOpenScripts={modalManager.openScripts}
        onRunScript={modalManager.runScript}
        onToggleTerminal={modalManager.toggleTerminal}
        onOpenFiles={modalManager.openFiles}
        filesOpen={modalManager.filesOpen}
        globalPaused={globalPaused}
        enginePaused={enginePaused}
        onToggleGlobalPause={toggleGlobalPause}
        onToggleEnginePause={toggleEnginePause}
        view={taskView}
        onChangeView={viewMode === "project" && currentProject ? handleTaskViewChange : undefined}
        showSkillsTab={skillsEnabled}
        showAgentsTab={agentsEnabled}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        projects={effectiveProjects}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        onViewAllProjects={handleViewAllProjects}
        projectId={currentProject?.id}
        mobileNavEnabled={isMobile}
        // Node switching props
        availableNodes={nodes}
        currentNode={currentNode}
        onSelectNode={(node) => {
          if (node === null) {
            clearCurrentNode();
          } else {
            setCurrentNode(node);
          }
        }}
        isRemote={isRemote}
        experimentalFeatures={{
          insights: insightsEnabled,
          roadmap: roadmapEnabled,
          memoryView: memoryEnabled,
          devServer: devServerEnabled,
          devServerView: devServerEnabled,
        }}
      />
      )}
      {viewMode === "project" && currentProject && !nodesOpen && taskView !== "missions" && !modalManager.isPlanningOpen && (
        <SessionNotificationBanner
          sessions={sessionsNeedingInput}
          onResumeSession={handleOpenBackgroundSession}
          onDismissSession={bgDismiss}
          onDismissAll={handleDismissAllNeedingInputSessions}
        />
      )}
      {viewMode === "project" && currentProject && showOnboardingResumeCard && (
        <OnboardingResumeCard onResume={modalManager.openModelOnboarding} />
      )}
      {viewMode === "project" && currentProject && showPostOnboardingRecommendations && (
        <PostOnboardingRecommendations
          onOpenModelOnboarding={modalManager.openModelOnboarding}
          onOpenSettings={(section) => modalManager.openSettings(section as SectionId)}
        />
      )}
      {viewMode === "project" && currentProject && !setupReadinessLoading && hasWarnings && !setupWarningDismissed && (
        <SetupWarningBanner
          hasAiProvider={hasAiProvider}
          hasGithub={hasGithub}
          onDismiss={handleDismissSetupWarning}
        />
      )}
      <div
        className={`project-content${viewMode === "project" && currentProject ? " project-content--with-footer" : ""}${isMobile ? " project-content--with-mobile-nav" : ""}`}
      >
        {renderMainContent()}
      </div>
      {viewMode === "project" && currentProject && !nodesOpen && (
        <ExecutorStatusBar
          tasks={isRemote && remoteData.tasks.length > 0 ? remoteData.tasks : tasks}
          projectId={currentProject.id}
          taskStuckTimeoutMs={taskStuckTimeoutMs}
          backgroundSessions={bgSessions}
          backgroundGenerating={bgGenerating}
          backgroundNeedsInput={bgNeedsInput}
          onOpenBackgroundSession={handleOpenBackgroundSession}
          onDismissBackgroundSession={bgDismiss}
          lastFetchTimeMs={lastFetchTimeMs}
          currentProjectPath={currentProject.path}
          onOpenProjectDirectory={handleOpenProjectDirectory}
        />
      )}
      <MobileNavBar
        view={taskView}
        onChangeView={viewMode === "project" && currentProject ? handleTaskViewChange : () => {}}
        footerVisible={viewMode === "project" && !!currentProject}
        modalOpen={modalManager.anyModalOpen}
        onOpenSettings={handleOpenSettings}
        onOpenActivityLog={modalManager.openActivityLog}
        onOpenMailbox={() => handleTaskViewChange("mailbox")}
        mailboxUnreadCount={mailboxUnreadCount}
        onOpenGitManager={modalManager.openGitManager}
        onOpenWorkflowSteps={modalManager.openWorkflowSteps}
        onOpenSchedules={modalManager.openSchedules}
        onOpenScripts={modalManager.openScripts}
        onToggleTerminal={modalManager.toggleTerminal}
        onOpenFiles={modalManager.openFiles}
        onOpenGitHubImport={modalManager.openGitHubImport}
        onOpenPlanning={modalManager.openPlanning}
        onResumePlanning={modalManager.resumePlanning}
        activePlanningSessionCount={bgPlanningSessions.length}
        onOpenUsage={() => modalManager.openUsage(null)}
        onViewAllProjects={handleViewAllProjects}
        onRunScript={modalManager.runScript}
        projectId={currentProject?.id}
        showSkillsTab={skillsEnabled}
        experimentalFeatures={{
          insights: insightsEnabled,
          roadmap: roadmapEnabled,
          memoryView: memoryEnabled,
          devServer: devServerEnabled,
          devServerView: devServerEnabled,
        }}
      />
      {viewMode === "project" && currentProject && taskView !== "chat" && taskView !== "mailbox" && taskView !== "insights" && taskView !== "devserver" && taskView !== "dev-server" && (
        <QuickChatFAB
          projectId={currentProject.id}
          addToast={addToast}
          showFAB={showQuickChatFAB}
          open={quickChatOpen}
          onOpenChange={setQuickChatOpen}
          favoriteProviders={favoriteProviders}
          favoriteModels={favoriteModels}
          onToggleFavorite={handleToggleFavorite}
          onToggleModelFavorite={handleToggleModelFavorite}
        />
      )}
      <AppModals
        projectId={currentProject?.id}
        tasks={tasks}
        projects={projects}
        currentProject={currentProject}
        addToast={addToast}
        toasts={toasts}
        removeToast={removeToast}
        modalManager={modalManager}
        projectActions={{ handleAddProject, handleSetupComplete, handleModelOnboardingComplete }}
        taskHandlers={{
          handleModalCreate,
          handlePlanningTaskCreated,
          handlePlanningTasksCreated,
          handleSubtaskTasksCreated,
          handleGitHubImport,
        }}
        taskOperations={{ moveTask, deleteTask, mergeTask, retryTask, duplicateTask }}
        deepLink={{ handleDetailClose }}
        settings={{ prAuthAvailable, themeMode, colorTheme, setThemeMode, setColorTheme }}
        onSettingsClose={() => {
          modalManager.closeSettings();
          void refreshAppSettings();
        }}
        onReopenOnboarding={() => {
          modalManager.closeSettings();
          modalManager.openModelOnboarding();
        }}
      />
      {optionEGlobalOverlays}
      {optionESpotlight}
    </>
  );
}

export function App() {
  return (
    <ToastProvider>
      <NodeProvider>
        <AppInner />
      </NodeProvider>
    </ToastProvider>
  );
}

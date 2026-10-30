/**
 * Role-Based Access Control (RBAC) and Granular Permission System
 * Supports Main Admin, Sub-Admin, Faculty, Staff, Student,
 * Delegated permissions, Branch/Degree access scopes, and granular rights.
 */

// Canonical Roles
export const ROLES = {
  MAIN_ADMIN: 'main_admin',
  SUB_ADMIN: 'sub_admin',
  FACULTY: 'faculty',
  STAFF: 'staff',
  STUDENT: 'student'
};

// Canonical Permissions
export const PERMISSIONS = {
  // Admin & Activity Management
  ADMIN_ACCESS: 'admin.access',
  CREATE_ACTIVITY: 'activities.create',
  MANAGE_ACTIVITY: 'activities.manage',
  DELETE_ACTIVITY: 'activities.delete',
  VIEW_ACTIVITIES: 'activities.view',
  DUPLICATE_ACTIVITY: 'activities.duplicate',

  // Submissions & Grading
  VIEW_SUBMISSIONS: 'submissions.view',
  GRADE_SUBMISSIONS: 'submissions.grade',
  VIEW_RESULTS: 'results.view',

  // Student / User Permissions
  JOIN_ACTIVITY: 'activities.join',
  VIEW_HISTORY: 'history.view',

  // Profile
  VIEW_PROFILE: 'profile.view',
  EDIT_PROFILE: 'profile.edit'
};

/**
 * Normalizes user role string from profileData, user object, or boolean flags
 * @param {object|null} profileData 
 * @param {object|null} user 
 * @returns {string} One of ROLES values
 */
export const getUserRole = (profileData, user) => {
  if (!profileData && !user) return ROLES.STUDENT;

  // 0. Check localStorage role override (useful for testing and development)
  try {
    const override = localStorage.getItem('taskgrade_role_override') || localStorage.getItem('quizora_role_override');
    if (override) {
      const cleanOverride = override.trim().toLowerCase().replace(/-/g, '_');
      if (['student', 'participant', 'learner'].includes(cleanOverride)) return ROLES.STUDENT;
      if (['main_admin', 'super_admin', 'admin'].includes(cleanOverride)) return ROLES.MAIN_ADMIN;
      if (['sub_admin', 'subadmin'].includes(cleanOverride)) return ROLES.SUB_ADMIN;
      if (['faculty', 'teacher', 'instructor'].includes(cleanOverride)) return ROLES.FACULTY;
      if (['staff', 'evaluator'].includes(cleanOverride)) return ROLES.STAFF;
    }
  } catch {
    // Ignore localStorage read errors
  }

  // 1. Check explicit student flag
  if (profileData?.isStudent) {
    return ROLES.STUDENT;
  }

  // 2. Check explicit admin / staff boolean flags
  if (profileData?.isMainAdmin || profileData?.isSuperAdmin) {
    return ROLES.MAIN_ADMIN;
  }
  if (profileData?.isAdmin) {
    return ROLES.MAIN_ADMIN;
  }
  if (profileData?.isSubAdmin) {
    return ROLES.SUB_ADMIN;
  }
  if (profileData?.isFaculty || profileData?.isTeacher || profileData?.isInstructor) {
    return ROLES.FACULTY;
  }
  if (profileData?.isStaff) {
    return ROLES.STAFF;
  }

  // 3. Check string role field (case-insensitive & trimmed, normalizing hyphens to underscores)
  const rawRole = (profileData?.role || user?.role || '').trim().toLowerCase().replace(/-/g, '_');
  if (rawRole) {
    if (['student', 'participant', 'learner'].includes(rawRole)) {
      return ROLES.STUDENT;
    }
    if (['main_admin', 'main admin', 'super_admin', 'superadmin', 'admin'].includes(rawRole)) {
      return ROLES.MAIN_ADMIN;
    }
    if (['sub_admin', 'sub admin', 'subadmin'].includes(rawRole)) {
      return ROLES.SUB_ADMIN;
    }
    if (['faculty', 'teacher', 'instructor', 'professor', 'educator'].includes(rawRole)) {
      return ROLES.FACULTY;
    }
    if (['staff', 'assistant', 'evaluator'].includes(rawRole)) {
      return ROLES.STAFF;
    }
  }

  // 4. Check array of roles if provided
  if (Array.isArray(profileData?.roles)) {
    const rolesLower = profileData.roles.map((r) => String(r).trim().toLowerCase().replace(/-/g, '_'));
    if (rolesLower.some((r) => ['student', 'participant'].includes(r))) {
      return ROLES.STUDENT;
    }
    if (rolesLower.some((r) => ['main_admin', 'main admin', 'super_admin', 'admin'].includes(r))) {
      return ROLES.MAIN_ADMIN;
    }
    if (rolesLower.some((r) => ['sub_admin', 'sub admin', 'subadmin'].includes(r))) {
      return ROLES.SUB_ADMIN;
    }
    if (rolesLower.some((r) => ['faculty', 'teacher', 'instructor'].includes(r))) {
      return ROLES.FACULTY;
    }
    if (rolesLower.some((r) => ['staff'].includes(r))) {
      return ROLES.STAFF;
    }
  }

  // 5. Default for authenticated Task Grade users:
  // In Task Grade, registered accounts are creators/administrators by default with full access
  // to create and manage their own activities, unless explicitly assigned a student role.
  return ROLES.MAIN_ADMIN;
};

/**
 * Checks if the user has a specific granular permission
 * @param {object|null} profileData 
 * @param {object|null} user 
 * @param {string} permission One of PERMISSIONS
 * @param {object} [context] Context such as { branch, degree, department, activityAdminUid }
 * @returns {boolean}
 */
export const hasPermission = (profileData, user, permission, context = {}) => {
  if (!user) return false;

  const role = getUserRole(profileData, user);

  // Main Admin has unconditional access to all permissions
  if (role === ROLES.MAIN_ADMIN) {
    return true;
  }

  // Check explicit granular permissions list on profileData
  const explicitPermissions = [];
  if (Array.isArray(profileData?.permissions)) {
    explicitPermissions.push(...profileData.permissions);
  }
  if (Array.isArray(profileData?.granularPermissions)) {
    explicitPermissions.push(...profileData.granularPermissions);
  }
  if (Array.isArray(profileData?.delegatedPermissions)) {
    explicitPermissions.push(...profileData.delegatedPermissions);
  }
  if (profileData?.permissions && typeof profileData.permissions === 'object' && !Array.isArray(profileData.permissions)) {
    Object.entries(profileData.permissions).forEach(([permKey, isAllowed]) => {
      if (isAllowed) explicitPermissions.push(permKey);
    });
  }

  // If explicit granular permission is granted, verify branch/degree restrictions if applicable
  const hasExplicitGrant = explicitPermissions.includes(permission) || explicitPermissions.includes('*');

  // Role-based baseline permissions
  let roleHasBaseline;

  switch (role) {
    case ROLES.SUB_ADMIN:
      roleHasBaseline = [
        PERMISSIONS.ADMIN_ACCESS,
        PERMISSIONS.CREATE_ACTIVITY,
        PERMISSIONS.MANAGE_ACTIVITY,
        PERMISSIONS.VIEW_ACTIVITIES,
        PERMISSIONS.DUPLICATE_ACTIVITY,
        PERMISSIONS.VIEW_SUBMISSIONS,
        PERMISSIONS.GRADE_SUBMISSIONS,
        PERMISSIONS.VIEW_RESULTS,
        PERMISSIONS.JOIN_ACTIVITY,
        PERMISSIONS.VIEW_HISTORY,
        PERMISSIONS.VIEW_PROFILE,
        PERMISSIONS.EDIT_PROFILE
      ].includes(permission);
      break;

    case ROLES.FACULTY:
      roleHasBaseline = [
        PERMISSIONS.ADMIN_ACCESS,
        PERMISSIONS.CREATE_ACTIVITY,
        PERMISSIONS.MANAGE_ACTIVITY,
        PERMISSIONS.VIEW_ACTIVITIES,
        PERMISSIONS.DUPLICATE_ACTIVITY,
        PERMISSIONS.VIEW_SUBMISSIONS,
        PERMISSIONS.GRADE_SUBMISSIONS,
        PERMISSIONS.VIEW_RESULTS,
        PERMISSIONS.JOIN_ACTIVITY,
        PERMISSIONS.VIEW_HISTORY,
        PERMISSIONS.VIEW_PROFILE,
        PERMISSIONS.EDIT_PROFILE
      ].includes(permission);
      break;

    case ROLES.STAFF:
      roleHasBaseline = [
        PERMISSIONS.ADMIN_ACCESS,
        PERMISSIONS.VIEW_ACTIVITIES,
        PERMISSIONS.VIEW_SUBMISSIONS,
        PERMISSIONS.GRADE_SUBMISSIONS,
        PERMISSIONS.VIEW_RESULTS,
        PERMISSIONS.JOIN_ACTIVITY,
        PERMISSIONS.VIEW_HISTORY,
        PERMISSIONS.VIEW_PROFILE,
        PERMISSIONS.EDIT_PROFILE
      ].includes(permission);
      break;

    case ROLES.STUDENT:
    default:
      roleHasBaseline = [
        PERMISSIONS.JOIN_ACTIVITY,
        PERMISSIONS.VIEW_HISTORY,
        PERMISSIONS.VIEW_PROFILE,
        PERMISSIONS.EDIT_PROFILE
      ].includes(permission);
      break;
  }

  const isPermitted = hasExplicitGrant || roleHasBaseline;
  if (!isPermitted) return false;

  // Enforce Degree / Branch / Scope restrictions when context is supplied
  if (context.branch || context.department) {
    const targetBranch = (context.branch || context.department || '').toLowerCase();
    const assignedBranches = [
      ...(Array.isArray(profileData?.assignedBranches) ? profileData.assignedBranches : []),
      profileData?.branch,
      profileData?.department
    ].filter(Boolean).map((b) => String(b).toLowerCase());

    if (assignedBranches.length > 0 && !assignedBranches.includes(targetBranch) && !assignedBranches.includes('*')) {
      return false;
    }
  }

  if (context.degree) {
    const targetDegree = String(context.degree).toLowerCase();
    const assignedDegrees = [
      ...(Array.isArray(profileData?.assignedDegrees) ? profileData.assignedDegrees : []),
      profileData?.degree
    ].filter(Boolean).map((d) => String(d).toLowerCase());

    if (assignedDegrees.length > 0 && !assignedDegrees.includes(targetDegree) && !assignedDegrees.includes('*')) {
      return false;
    }
  }

  return true;
};

/**
 * Route Permission Definitions
 * Maps route paths to required permissions and roles
 */
export const ROUTE_PERMISSIONS = {
  '/dashboard': {
    authRequired: true,
    permission: PERMISSIONS.VIEW_HISTORY,
    description: 'User Dashboard'
  },
  '/profile': {
    authRequired: true,
    permission: PERMISSIONS.VIEW_PROFILE,
    description: 'User Profile'
  },
  '/profile/edit': {
    authRequired: true,
    permission: PERMISSIONS.EDIT_PROFILE,
    description: 'Edit User Profile'
  },
  '/admin': {
    authRequired: true,
    permission: PERMISSIONS.ADMIN_ACCESS,
    description: 'Admin Portal & Activity Management'
  },
  '/admin/create': {
    authRequired: true,
    permission: PERMISSIONS.CREATE_ACTIVITY,
    description: 'Activity Creator Wizard'
  },
  '/admin/submissions': {
    authRequired: true,
    permission: PERMISSIONS.VIEW_SUBMISSIONS,
    description: 'Participant Submissions'
  },
  '/admin/results': {
    authRequired: true,
    permission: PERMISSIONS.VIEW_RESULTS,
    description: 'Activity Results'
  }
};

/**
 * Checks whether user has permission to open a given route path
 * @param {string} path 
 * @param {object|null} profileData 
 * @param {object|null} user 
 * @returns {{ allowed: boolean, reason?: string, code?: string, requiredRole?: string, requiredPermission?: string }}
 */
export const canAccessRoute = (path, profileData, user) => {
  // Public or dynamic student activity routes
  if (path.startsWith('/activity/')) {
    return { allowed: true };
  }
  if (['/login', '/register', '/verify-email', '/complete-profile'].includes(path)) {
    return { allowed: true };
  }

  // Not authenticated
  if (!user) {
    return {
      allowed: false,
      reason: 'Authentication required',
      code: 'UNAUTHENTICATED'
    };
  }

  // Match route permission
  let routeConfig = ROUTE_PERMISSIONS[path];

  // Dynamic route matching
  if (!routeConfig) {
    if (path.startsWith('/admin/submissions/')) {
      routeConfig = ROUTE_PERMISSIONS['/admin/submissions'];
    } else if (path.startsWith('/admin/results/')) {
      routeConfig = ROUTE_PERMISSIONS['/admin/results'];
    } else if (path.startsWith('/admin')) {
      routeConfig = ROUTE_PERMISSIONS['/admin'];
    }
  }

  // Unknown route
  if (!routeConfig) {
    return { allowed: true };
  }

  const allowed = hasPermission(profileData, user, routeConfig.permission);
  if (!allowed) {
    const userRole = getUserRole(profileData, user);
    return {
      allowed: false,
      reason: `Access restricted. Role "${userRole.toUpperCase()}" lacks required permission "${routeConfig.permission}".`,
      code: 'FORBIDDEN',
      requiredPermission: routeConfig.permission,
      requiredRole: 'Admin / Faculty'
    };
  }

  return { allowed: true };
};


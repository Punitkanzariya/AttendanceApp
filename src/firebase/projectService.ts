import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import type { Project, User, ProjectEmployee, ProjectHistory } from '@/types';

/**
 * Fetch all users by role for dropdowns
 */
export async function fetchUsersByRole(role: string): Promise<User[]> {
  try {
    const q = query(collection(db, 'users', role, 'profiles'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
  } catch (error) {
    console.error(`[projectService] fetchUsersByRole ${role} error:`, error);
    return [];
  }
}

/**
 * Fetch all projects
 */
export async function fetchProjects(): Promise<Project[]> {
  try {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
  } catch (error) {
    console.error('[projectService] fetchProjects error:', error);
    return [];
  }
}

/**
 * Subscribe to all users by role for real-time dropdowns
 */
export function subscribeToUsersByRole(role: string, callback: (users: User[]) => void): () => void {
  const q = query(collection(db, 'users', role, 'profiles'));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as User));
    callback(users);
  }, (error) => {
    console.error(`[projectService] subscribeToUsersByRole ${role} error:`, error);
    callback([]);
  });
}

/**
 * Subscribe to all projects in real-time
 */
export function subscribeToAllProjects(callback: (projects: Project[]) => void): () => void {
  const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
    callback(projects);
  }, (error) => {
    console.error('[projectService] subscribeToAllProjects error:', error);
    callback([]);
  });
}

/**
 * Fetch the active project that an employee is currently assigned to.
 */
export async function getEmployeeActiveProject(employeeId: string): Promise<Project | null> {
  try {
    const q = query(collection(db, 'projects'), where('isClosed', '==', false));
    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
      const projData = docSnap.data() as Project;
      if (projData.siteEmployees?.some(e => e.employeeId === employeeId)) {
        return { ...projData, id: docSnap.id };
      }
    }
    return null;
  } catch (error) {
    console.error('[projectService] getEmployeeActiveProject error:', error);
    return null;
  }
}

/**
 * Ensures that the given employees are not assigned to any other project.
 * If they are, it removes them from the old project and logs the removal history.
 */
async function ensureEmployeesAreUniqueToProject(
  employees: ProjectEmployee[],
  currentProjectId: string | null,
  adminUid: string
) {
  if (!employees || employees.length === 0) return;

  const allProjectsSnap = await getDocs(collection(db, 'projects'));
  
  for (const docSnap of allProjectsSnap.docs) {
    const projId = docSnap.id;
    if (projId === currentProjectId) continue; // Skip current project

    const projData = docSnap.data() as Project;
    const oldSiteEmployees = projData.siteEmployees || [];
    
    // Check if any of the new employees exist in this project
    const newSiteEmployees = oldSiteEmployees.filter(oldEmp => {
      return !employees.some(newEmp => newEmp.employeeId === oldEmp.employeeId);
    });

    // If the length changed, it means we found and removed someone
    if (newSiteEmployees.length !== oldSiteEmployees.length) {
      // Find exactly who was removed for history
      const removedEmployees = oldSiteEmployees.filter(oldEmp => 
        employees.some(newEmp => newEmp.employeeId === oldEmp.employeeId)
      );

      // Update the old project to remove the employees
      await updateDoc(doc(db, 'projects', projId), {
        siteEmployees: newSiteEmployees,
        updatedAt: new Date().toISOString(),
      });

      // Log history
      for (const removed of removedEmployees) {
        await logProjectHistory({
          projectId: projId,
          projectName: projData.projectName,
          employeeId: removed.employeeId,
          employeeName: removed.employeeName,
          action: 'removed',
          performedBy: adminUid,
        });
      }
    }
  }
}

/**
 * Create a new project
 */
export async function createProject(
  projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>,
  adminUid: string
): Promise<string> {
  try {
    const docRef = doc(collection(db, 'projects'));
    const now = new Date().toISOString();
    
    const newProject: Project = {
      ...projectData,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };
    
    // Remove these employees from any other projects before saving
    await ensureEmployeesAreUniqueToProject(projectData.siteEmployees || [], null, adminUid);

    await setDoc(docRef, newProject);

    // Record history for all newly assigned employees
    for (const emp of projectData.siteEmployees) {
      await logProjectHistory({
        projectId: docRef.id,
        projectName: projectData.projectName,
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        action: 'added',
        shift: emp.shift,
        performedBy: adminUid,
      });
    }

    return docRef.id;
  } catch (error) {
    console.error('[projectService] createProject error:', error);
    throw error;
  }
}

/**
 * Update a project and log employee movement history
 */
export async function updateProject(
  projectId: string,
  updatedData: Partial<Project>,
  adminUid: string
): Promise<void> {
  try {
    const projectRef = doc(db, 'projects', projectId);
    
    // If employees are being updated, we need to compare old and new to log history
    if (updatedData.siteEmployees) {
      const snap = await getDoc(projectRef);
      if (snap.exists()) {
        const oldData = snap.data() as Project;
        const oldEmployees = oldData.siteEmployees || [];
        const newEmployees = updatedData.siteEmployees;

        const projectName = updatedData.projectName || oldData.projectName;

        // Check for removed employees
        for (const oldEmp of oldEmployees) {
          const stillExists = newEmployees.find(e => e.employeeId === oldEmp.employeeId);
          if (!stillExists) {
            await logProjectHistory({
              projectId,
              projectName,
              employeeId: oldEmp.employeeId,
              employeeName: oldEmp.employeeName,
              action: 'removed',
              performedBy: adminUid,
            });
          }
        }

        // Check for added or shift_changed employees
        for (const newEmp of newEmployees) {
          const existed = oldEmployees.find(e => e.employeeId === newEmp.employeeId);
          if (!existed) {
            await logProjectHistory({
              projectId,
              projectName,
              employeeId: newEmp.employeeId,
              employeeName: newEmp.employeeName,
              action: 'added',
              shift: newEmp.shift,
              performedBy: adminUid,
            });
          } else if (existed.shift !== newEmp.shift) {
            await logProjectHistory({
              projectId,
              projectName,
              employeeId: newEmp.employeeId,
              employeeName: newEmp.employeeName,
              action: 'shift_changed',
              shift: newEmp.shift,
              performedBy: adminUid,
            });
          }
        }
      }

      // Remove the newly added/updated employees from ANY OTHER projects
      await ensureEmployeesAreUniqueToProject(updatedData.siteEmployees, projectId, adminUid);
    }

    await updateDoc(projectRef, {
      ...updatedData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[projectService] updateProject error:', error);
    throw error;
  }
}

/**
 * Log employee movement history
 */
async function logProjectHistory(data: Omit<ProjectHistory, 'id' | 'timestamp'>): Promise<void> {
  try {
    const historyRef = doc(collection(db, 'project_history'));
    const record: ProjectHistory = {
      ...data,
      id: historyRef.id,
      timestamp: new Date().toISOString(),
    };
    await setDoc(historyRef, record);
  } catch (error) {
    console.error('[projectService] logProjectHistory error:', error);
  }
}

/**
 * Fetch project history
 */
export async function fetchProjectHistory(projectId?: string): Promise<ProjectHistory[]> {
  try {
    let q = query(collection(db, 'project_history'), orderBy('timestamp', 'desc'));
    if (projectId) {
      q = query(collection(db, 'project_history'), where('projectId', '==', projectId), orderBy('timestamp', 'desc'));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ProjectHistory);
  } catch (error) {
    console.error('[projectService] fetchProjectHistory error:', error);
    return [];
  }
}

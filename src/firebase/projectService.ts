import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from './config';
import type { Project } from '@/types';

/**
 * Fetch the active project that an employee is currently assigned to.
 */
export async function getEmployeeActiveProject(employeeId: string, projectId?: string): Promise<Project | null> {
  try {
    if (projectId) {
      const snap = await getDoc(doc(db, 'projects', projectId));
      if (snap.exists()) {
        return { ...snap.data(), projectId: snap.id } as Project;
      }
    }

    const q = query(collection(db, 'projects'), where('status', 'in', ['active', 'on_hold']));
    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
      const projData = docSnap.data() as Project;
      if (projData.employeeIds?.includes(employeeId)) {
        return { ...projData, projectId: docSnap.id };
      }
    }
    return null;
  } catch (error) {
    console.error('[projectService] getEmployeeActiveProject error:', error);
    return null;
  }
}

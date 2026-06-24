import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Switch, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SelectDropdown from '@/components/shared/SelectDropdown';
import MultiSelectDropdown from '@/components/shared/MultiSelectDropdown';
import GeoFenceMap from '@/components/shared/GeoFenceMap';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { updateProject, subscribeToUsersByRole } from '@/firebase/projectService';
import type { User, ProjectType, ProjectShift, ProjectEmployee, Project } from '@/types';

interface ProjectEditModalProps {
  visible: boolean;
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
  adminUid: string;
}

export default function ProjectEditModal({ visible, project, onClose, onSuccess, adminUid }: ProjectEditModalProps) {
  const [projectName, setProjectName] = useState(project.projectName);
  const [projectAlias, setProjectAlias] = useState(project.projectAlias || '');
  const [isClosed, setIsClosed] = useState(project.isClosed);
  const [projectType, setProjectType] = useState<ProjectType>(project.projectType || 'Type 1');

  const [geoFencingEnabled, setGeoFencingEnabled] = useState(project.geoFencing?.enabled || false);
  const [latitude, setLatitude] = useState(project.geoFencing?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(project.geoFencing?.longitude?.toString() || '');
  const [radiusMeters, setRadiusMeters] = useState(project.geoFencing?.radiusMeters?.toString() || '200');

  const [projectManagerId, setProjectManagerId] = useState(project.projectManagerId || '');
  const [projectCoordinatorId, setProjectCoordinatorId] = useState(project.projectCoordinatorId || '');

  const [siteEmployees, setSiteEmployees] = useState<ProjectEmployee[]>(project.siteEmployees || []);

  const [managers, setManagers] = useState<User[]>([]);
  const [coordinators, setCoordinators] = useState<User[]>([]);
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    
    setIsLoading(true);
    
    const unsubMgrs = subscribeToUsersByRole('project_manager', (data) => {
      setManagers(data);
    });
    
    const unsubCoords = subscribeToUsersByRole('project_coordinator', (data) => {
      setCoordinators(data);
    });
    
    const unsubEmps = subscribeToUsersByRole('employee', (data) => {
      setAllEmployees(data);
      setIsLoading(false);
    });

    return () => {
      unsubMgrs();
      unsubCoords();
      unsubEmps();
    };
  }, [visible]);

  useEffect(() => {
    if (project && visible) {
      setProjectName(project.projectName);
      setProjectAlias(project.projectAlias || '');
      setProjectType(project.projectType || 'Type 1');
      setProjectManagerId(project.projectManagerId || '');
      setProjectCoordinatorId(project.projectCoordinatorId || '');
      setLatitude(project.geoFencing?.latitude?.toString() || '');
      setLongitude(project.geoFencing?.longitude?.toString() || '');
      setRadiusMeters(project.geoFencing?.radiusMeters?.toString() || '200');
      setSiteEmployees(project.siteEmployees || []);
      setIsClosed(project.isClosed || false);
      setGeoFencingEnabled(project.geoFencing?.enabled || false);
    }
  }, [project, visible]);

  const handleSelectEmployees = (selectedUids: string[]) => {
    // Keep existing employees that are still selected
    const updatedEmployees = siteEmployees.filter(emp => selectedUids.includes(emp.employeeId));
    
    // Add new employees with default shift 'Day'
    selectedUids.forEach(uid => {
      if (!updatedEmployees.find(e => e.employeeId === uid)) {
        const empObj = allEmployees.find(e => e.uid === uid);
        if (empObj) {
          updatedEmployees.push({
            employeeId: empObj.uid,
            employeeName: empObj.displayName || empObj.username,
            shift: 'Day'
          });
        }
      }
    });

    setSiteEmployees(updatedEmployees);
  };

  const toggleShift = (empId: string) => {
    setSiteEmployees(siteEmployees.map(emp => {
      if (emp.employeeId === empId) {
        return { ...emp, shift: emp.shift === 'Day' ? 'Night' : 'Day' };
      }
      return emp;
    }));
  };

  const removeEmployee = (empId: string) => {
    setSiteEmployees(siteEmployees.filter(e => e.employeeId !== empId));
  };

  const handleSave = async () => {
    if (!projectName.trim()) {
      Alert.alert('Error', 'Project Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const pm = managers.find(m => m.uid === projectManagerId);
      const pc = coordinators.find(c => c.uid === projectCoordinatorId);

      await updateProject(project.id, {
        projectName: projectName.trim(),
        projectAlias: projectAlias.trim(),
        isClosed,
        projectType,
        projectManagerId: pm?.uid || projectManagerId,
        projectManagerName: pm?.displayName || pm?.username || project.projectManagerName,
        projectCoordinatorId: pc?.uid || projectCoordinatorId,
        projectCoordinatorName: pc?.displayName || pc?.username || project.projectCoordinatorName,
        siteEmployees,
        geoFencing: {
          enabled: geoFencingEnabled,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
          radiusMeters: radiusMeters ? parseInt(radiusMeters, 10) : 200,
        }
      }, adminUid);

      onSuccess();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update project');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Project</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={isSaving}>
              <Ionicons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* General Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>General Information</Text>
              
              <Text style={styles.label}>Project Name *</Text>
              <TextInput style={styles.inputBox} value={projectName} onChangeText={setProjectName} />
              
              <Text style={styles.label}>Project Alias / Nickname</Text>
              <TextInput style={styles.inputBox} value={projectAlias} onChangeText={setProjectAlias} />
              
              <SelectDropdown
                label="Project Type"
                value={projectType}
                onSelect={(val) => setProjectType(val as ProjectType)}
                options={[
                  { label: 'Type 1', value: 'Type 1' },
                  { label: 'Type 2', value: 'Type 2' },
                  { label: 'Type 3', value: 'Type 3' },
                ]}
              />

              <View style={styles.rowBetween}>
                <Text style={styles.label}>Close Project</Text>
                <Switch 
                  value={isClosed} 
                  onValueChange={setIsClosed} 
                  trackColor={{ false: '#CBD5E1', true: Colors.error }}
                  thumbColor={Colors.white}
                  ios_backgroundColor="#CBD5E1"
                />
              </View>
            </View>

            {/* Management */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Management</Text>
              
              <SelectDropdown
                label="Project Manager"
                value={projectManagerId}
                onSelect={setProjectManagerId}
                options={managers.map(m => ({ label: m.displayName || m.username, value: m.uid }))}
                placeholder="Select Manager..."
              />

              <SelectDropdown
                label="Project Co-ordinator"
                value={projectCoordinatorId}
                onSelect={setProjectCoordinatorId}
                options={coordinators.map(c => ({ label: c.displayName || c.username, value: c.uid }))}
                placeholder="Select Coordinator..."
              />
            </View>

            {/* Geo Fencing */}
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Geo Fencing</Text>
                <Switch 
                  value={geoFencingEnabled} 
                  onValueChange={setGeoFencingEnabled} 
                  trackColor={{ false: '#CBD5E1', true: Colors.primary }}
                  thumbColor={Colors.white}
                  ios_backgroundColor="#CBD5E1"
                />
              </View>

              {geoFencingEnabled && (
                <View style={{ marginTop: Spacing.sm }}>
                  <Text style={styles.label}>Latitude</Text>
                  <TextInput style={styles.inputBox} value={latitude} onChangeText={setLatitude} keyboardType="numeric" />
                  
                  <Text style={styles.label}>Longitude</Text>
                  <TextInput style={styles.inputBox} value={longitude} onChangeText={setLongitude} keyboardType="numeric" />
                  
                  <Text style={styles.label}>Radius (meters)</Text>
                  <TextInput style={styles.inputBox} value={radiusMeters} onChangeText={setRadiusMeters} keyboardType="numeric" />
                  
                  <GeoFenceMap latitude={latitude} longitude={longitude} radius={radiusMeters} />
                </View>
              )}
            </View>

            {/* Assigned Employees */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Assigned Employees ({siteEmployees.length})</Text>

              <MultiSelectDropdown
                label="Select Employees"
                options={allEmployees.map(e => ({ label: e.displayName || e.username, value: e.uid }))}
                selectedValues={siteEmployees.map(e => e.employeeId)}
                onConfirm={handleSelectEmployees}
                placeholder="Select employees..."
              />

              <View style={styles.employeeList}>
                {siteEmployees.length === 0 ? (
                  <Text style={styles.noEmployeesText}>No employees assigned yet.</Text>
                ) : (
                  siteEmployees.map(emp => (
                    <View key={emp.employeeId} style={styles.employeeCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.empName}>{emp.employeeName}</Text>
                        <TouchableOpacity 
                          style={[styles.shiftToggleInline, emp.shift === 'Night' && styles.shiftToggleInlineNight]}
                          onPress={() => toggleShift(emp.employeeId)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={emp.shift === 'Night' ? 'moon' : 'sunny'} size={14} color={emp.shift === 'Night' ? '#E0E7FF' : '#854D0E'} />
                          <Text style={[styles.shiftToggleText, emp.shift === 'Night' && { color: '#E0E7FF' }]}>{emp.shift}</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={() => removeEmployee(emp.employeeId)} style={styles.removeBtn}>
                        <Ionicons name="trash-outline" size={20} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveTxt}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  sheet: {
    backgroundColor: Colors.white,
    flex: 1, // Full screen
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary },
  closeBtn: { padding: Spacing.xs },
  content: { padding: Spacing.xl },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text.primary, marginBottom: 8, marginTop: Spacing.sm },
  inputBox: { backgroundColor: Colors.white, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSize.md, color: Colors.text.primary, marginBottom: Spacing.md, ...(Platform.OS === 'web' && { outlineStyle: 'none' }) },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  employeeList: { marginTop: Spacing.sm },
  noEmployeesText: { fontSize: FontSize.sm, color: Colors.text.secondary, fontStyle: 'italic' },
  employeeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  shiftToggleInline: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF9C3', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, alignSelf: 'flex-start', marginTop: 6, borderWidth: 1, borderColor: '#FDE047', gap: 4 },
  shiftToggleInlineNight: { backgroundColor: '#1E1B4B', borderColor: '#312E81' },
  shiftToggleText: { fontSize: 12, fontWeight: 'bold', color: '#854D0E' },
  removeBtn: { padding: Spacing.sm },
  empName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text.primary },
  empShift: { fontSize: FontSize.xs, color: Colors.text.secondary, marginTop: 2 },
  footer: { flexDirection: 'row', padding: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.md },
  cancelBtn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: Colors.background },
  cancelTxt: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text.secondary },
  saveBtn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, backgroundColor: Colors.primary },
  saveTxt: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.white },
});

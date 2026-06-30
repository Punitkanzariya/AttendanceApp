import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { subscribeToAllProjects } from '@/firebase/projectService';
import type { Project } from '@/types';
import ProjectAddModal from './components/ProjectAddModal';
import ProjectEditModal from './components/ProjectEditModal';
import { useAuthStore } from '@/store/authStore';

export default function AdminProjectsScreen() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAllProjects((data) => {
      setProjects(data);
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRefresh = () => {
    // In a real-time list, manual refresh is mostly visual feedback
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const renderProjectCard = ({ item }: { item: Project }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => setSelectedProject(item)}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.projectName}>{item.projectName}</Text>
          {item.projectAlias ? (
            <Text style={styles.projectAlias}>{item.projectAlias}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, item.isClosed ? styles.statusClosed : styles.statusActive]}>
          <Text style={[styles.statusTxt, item.isClosed ? styles.statusTxtClosed : styles.statusTxtActive]}>
            {item.isClosed ? 'Closed' : 'Active'}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="briefcase-outline" size={16} color={Colors.text.tertiary} />
          <Text style={styles.detailTxt}>Manager: {item.projectManagerName || 'Unassigned'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="people-outline" size={16} color={Colors.text.tertiary} />
          <Text style={styles.detailTxt}>{item.siteEmployees?.length || 0} Employees Assigned</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color={Colors.text.tertiary} />
          <Text style={styles.detailTxt}>
            Geo Fencing: {item.geoFencing?.enabled ? `Enabled (${item.geoFencing.radiusMeters || 200}m)` : 'Disabled'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Projects</Text>
          <Text style={styles.subtitle}>Manage sites and assignments</Text>
        </View>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderProjectCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={64} color={Colors.text.tertiary} />
              <Text style={styles.emptyTitle}>No Projects Found</Text>
              <Text style={styles.emptySub}>Tap the + button to add a new project.</Text>
            </View>
          }
        />
      )}

      {/* Add Modal */}
      {user && showAddModal && (
        <ProjectAddModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
          }}
          adminUid={user.uid}
        />
      )}

      {/* Edit Modal */}
      {user && selectedProject && (
        <ProjectEditModal
          visible={!!selectedProject}
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSuccess={() => {
            setSelectedProject(null);
          }}
          adminUid={user.uid}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.xl,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  projectName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  projectAlias: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusActive: {
    backgroundColor: Colors.primaryLight,
  },
  statusClosed: {
    backgroundColor: Colors.border,
  },
  statusTxt: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  statusTxtActive: {
    color: Colors.primary,
  },
  statusTxtClosed: {
    color: Colors.text.secondary,
  },
  cardDetails: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailTxt: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
  },
  emptySub: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
});

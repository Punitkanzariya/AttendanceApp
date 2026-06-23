import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { firebaseLogout } from '@/firebase';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  title: string;
  iconName?: IoniconsName;
  description?: string;
}

export default function PlaceholderScreen({
  title,
  iconName = 'construct',
  description,
}: Props) {
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    await firebaseLogout();
    await logout();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name={iconName} size={48} color={Colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {description && (
          <Text style={styles.desc}>{description}</Text>
        )}
        <View style={styles.badge}>
          <Ionicons name="construct-outline" size={12} color={Colors.text.tertiary} />
          <Text style={styles.badgeText}>Under Construction</Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutTxt}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.employeeBg },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadow.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  desc: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.medium,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error + '40', // 40% opacity
    backgroundColor: Colors.error + '10', // 10% opacity
  },
  logoutTxt: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.error,
  },
});

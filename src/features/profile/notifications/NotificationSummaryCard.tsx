import { Text, View } from 'react-native';

import type { NotificationSummary } from '../../notifications/types';
import type { PermissionState } from './notificationScreen.shared';
import { styles } from './notificationScreen.styles';

type NotificationSummaryCardProps = {
  notifications: NotificationSummary[];
  permissionState: PermissionState;
};

export function NotificationSummaryCard({ notifications, permissionState }: NotificationSummaryCardProps) {
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const registrationCount = notifications.filter((item) => item.type === 'event_registration').length;

  const badgeColors =
    permissionState === 'granted' ? ['#DCFCE7', '#BBF7D0'] : ['#FEE2E2', '#FECACA'];
  const badgeTextColor = permissionState === 'granted' ? '#166534' : '#991B1B';

  return (
    <View style={styles.summaryCard}>

      <View style={styles.summaryTopRow}>
        <View style={[styles.summaryBadge, { backgroundColor: badgeColors[0] }]}>
          <Text style={[styles.summaryBadgeText, { color: badgeTextColor }]}>
            {permissionState === 'granted' ? 'Alerts enabled' : 'Needs permission'}
          </Text>
        </View>
        <Text style={styles.summaryMeta}>{notifications.length} total items</Text>
      </View>

      <Text style={styles.summaryTitle}>Organizer activity at a glance</Text>
      <Text style={styles.summaryText}>
        Keep an eye on registrations and make sure your phone is ready to receive updates from your events.
      </Text>

      <View style={styles.summaryStats}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatValue}>{notifications.length}</Text>
          <Text style={styles.summaryStatLabel}>Recent notifications</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatValue}>{registrationCount}</Text>
          <Text style={styles.summaryStatLabel}>Registration updates</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatValue}>{unreadCount}</Text>
          <Text style={styles.summaryStatLabel}>Unread status markers</Text>
        </View>
      </View>
    </View>
  );
}

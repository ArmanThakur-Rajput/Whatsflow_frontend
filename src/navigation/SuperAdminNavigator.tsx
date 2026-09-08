import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import SuperAdminDashboardScreen from '../screens/superadmin/SuperAdminDashboardScreen';
import SuperAdminOrgAdminsScreen from '../screens/superadmin/SuperAdminOrgAdminsScreen';
import SuperAdminAddAdminScreen from '../screens/superadmin/SuperAdminAddAdminScreen';
import SuperAdminEditAdminScreen from '../screens/superadmin/SuperAdminEditAdminScreen';

const Stack = createStackNavigator();

// Super admin's panel is intentionally a flat stack, not a tab bar —
// this is a small monitoring/management tool (orgs + admins only), not
// a full app surface like the admin/employee experiences.
export default function SuperAdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SuperAdminDashboard" component={SuperAdminDashboardScreen} />
      <Stack.Screen name="SuperAdminOrgAdmins" component={SuperAdminOrgAdminsScreen} />
      <Stack.Screen name="SuperAdminAddAdmin" component={SuperAdminAddAdminScreen} />
      <Stack.Screen name="SuperAdminEditAdmin" component={SuperAdminEditAdminScreen} />
    </Stack.Navigator>
  );
}

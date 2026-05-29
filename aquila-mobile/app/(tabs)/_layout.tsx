import { Tabs } from 'expo-router'
import { colors } from '../../lib/theme'

function TabIcon({ focused, char }: { focused: boolean; char: string }) {
  const { Text } = require('react-native')
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.35 }}>{char}</Text>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:     false,
        tabBarStyle: {
          backgroundColor:  colors.surface,
          borderTopWidth:   0.5,
          borderTopColor:   colors.border,
          height:           80,
          paddingBottom:    20,
          paddingTop:       10,
        },
        tabBarActiveTintColor:   colors.gold,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} char="◎" />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} char="✓" />,
        }}
      />
      <Tabs.Screen
        name="followups"
        options={{
          title: 'Follow-ups',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} char="↗" />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'At Risk',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} char="!" />,
        }}
      />
    </Tabs>
  )
}

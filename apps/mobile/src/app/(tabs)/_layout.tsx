import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:       true,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor:  '#E5E7EB',
          paddingTop:      6,
          height:          60,
        },
        headerStyle:       { backgroundColor: '#1E3A5F' },
        headerTintColor:   '#fff',
        headerTitleStyle:  { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
          headerTitle: 'TrackPro GPS',
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} />,
          headerTitle: 'Mapa en vivo',
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color, size }) => <Ionicons name="warning-outline" color={color} size={size} />,
          headerTitle: 'Alertas',
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          title: 'Flota',
          tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" color={color} size={size} />,
          headerTitle: 'Mi Flota',
        }}
      />
    </Tabs>
  )
}

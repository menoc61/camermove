import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AnimatedPressFeedback } from "@/components/ui/animated-pressable";
import { colors } from "@/constants/theme";

type TabBarRenderProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];

/**
 * Custom Swiss/Bauhaus square-corner tab bar. Each tab uses
 * AnimatedPressFeedback so the press animation matches the rest of the
 * primitives (and collapses to instant when reduce-motion is on).
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props: TabBarRenderProps) => <SwissTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="search" options={{ title: "Recherche" }} />
      <Tabs.Screen name="tickets" options={{ title: "Billets" }} />
      <Tabs.Screen name="account" options={{ title: "Compte" }} />
    </Tabs>
  );
}

function SwissTabBar(props: TabBarRenderProps) {
  const { state, descriptors, navigation } = props;
  return (
    <View style={styles.bar}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const desc = descriptors[route.key];
        const label =
          (desc?.options?.title as string | undefined) ?? route.name;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        return (
          <AnimatedPressFeedback
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            style={styles.cell}
          >
            <Text style={[styles.label, focused && styles.labelActive]}>
              {label}
            </Text>
            <View
              style={[
                styles.indicator,
                focused ? styles.indicatorActive : null,
              ]}
            />
          </AnimatedPressFeedback>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  cell: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink2,
  },
  labelActive: { color: colors.ink },
  indicator: {
    height: 2,
    width: 16,
    backgroundColor: "transparent",
  },
  indicatorActive: { backgroundColor: colors.ink },
});

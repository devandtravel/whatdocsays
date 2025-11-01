import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PropsWithChildren } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { theme } from "../theme";

const ErrorFallback = ({ error }: { error: Error }) => (
	<View
		style={{
			flex: 1,
			justifyContent: "center",
			alignItems: "center",
			padding: 20,
		}}
	>
		<Text
			style={{
				fontSize: 18,
				fontWeight: "bold",
				color: theme.colors.danger,
				marginBottom: 10,
			}}
		>
			Something went wrong
		</Text>
		<Text style={{ color: theme.colors.textMuted, textAlign: "center" }}>
			{error.message}
		</Text>
	</View>
);

const ScreenContainer = ({ children }: PropsWithChildren) => (
	<GestureHandlerRootView
		style={{ flex: 1, backgroundColor: theme.colors.background }}
	>
		<ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
	</GestureHandlerRootView>
);

export default function RootLayout() {
	return (
		<ScreenContainer>
			<StatusBar style="dark" />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: theme.colors.background },
					headerTintColor: theme.colors.text,
					contentStyle: { backgroundColor: theme.colors.background },
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen
					name="capture"
					options={{ title: "Capture Prescription" }}
				/>
				<Stack.Screen name="review" options={{ title: "Review & Edit" }} />
				<Stack.Screen name="schedule" options={{ title: "Schedule Plan" }} />
			</Stack>
		</ScreenContainer>
	);
}

import { TouchableOpacity, Text } from "react-native";
import { ShareIntentProvider } from "expo-share-intent";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./src/screens/HomeScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <ShareIntentProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={({ navigation }) => ({
              title: "MEmail",
              headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
                  <Text style={{ fontSize: 22 }}>⚙</Text>
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ShareIntentProvider>
  );
}

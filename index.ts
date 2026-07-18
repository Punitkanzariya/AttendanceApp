import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { Alert } from 'react-native';

const defaultErrorHandler = (global as any).ErrorUtils?.getGlobalHandler();
(global as any).ErrorUtils?.setGlobalHandler((error: any, isFatal: boolean) => {
  Alert.alert(
    'Application Error',
    `Error: ${error?.message || error}\n\nPlease take a screenshot and send it to the developer.`,
    [
      {
        text: 'OK',
        onPress: () => {
          // You can call default handler if you want it to crash afterwards
          // if (defaultErrorHandler) defaultErrorHandler(error, isFatal);
        }
      }
    ]
  );
});

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

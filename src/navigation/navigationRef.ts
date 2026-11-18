import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** Lets auth deep links (password recovery, email confirmation) route the app. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

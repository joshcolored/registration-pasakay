import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'firebase_options.dart';
import 'config/env_config.dart';
import 'utils/constants.dart';
import 'screens/common/app_update_gate.dart';
import 'screens/auth/splash_screen.dart';
import 'services/notification_service.dart';
import 'services/notification_navigation_service.dart';
import 'providers/auth_provider.dart';
import 'providers/trip_provider.dart';
import 'providers/driver_provider.dart';

/// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  debugPrint('Handling background message: ${message.messageId}');
}

/// Check if running on a real device (not simulator/emulator)
bool get isRealDevice {
  if (kIsWeb) return false;

  // On iOS simulator, this will be false
  // On Android emulator, this will be false
  // On real devices, this will be true
  return !Platform.environment.containsKey('SIMULATOR_DEVICE_NAME') &&
         !Platform.environment.containsKey('ANDROID_EMULATOR');
}

void main() async {
  // Catch all errors
  FlutterError.onError = (FlutterErrorDetails details) {
    debugPrint('❌ Flutter Error: ${details.exception}');
    debugPrint('Stack trace: ${details.stack}');
  };

  WidgetsFlutterBinding.ensureInitialized();

  // Initialize port for foreground task communication
  FlutterForegroundTask.initCommunicationPort();

  try {
    debugPrint('🚀 Starting Pasakay app...');

    // Load environment variables
    await EnvConfig.load();
    debugPrint('✅ Environment variables loaded');

    debugPrint('📱 Platform: ${Platform.operatingSystem}');
    debugPrint('🔧 Is Real Device: $isRealDevice');

    // Initialize Firebase with platform-specific options
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    debugPrint('✅ Firebase initialized successfully');

    // Only initialize messaging on real devices (not simulators)
    if (isRealDevice) {
      try {
        // Set background message handler
        FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

        // Initialize notification service
        await NotificationService().initialize();
        debugPrint('✅ Notification service initialized');
      } catch (e) {
        debugPrint('⚠️ Notification service error: $e');
      }
    } else {
      debugPrint('⚠️ Skipping notification service (running on simulator/emulator)');
    }
  } catch (e, stackTrace) {
    debugPrint('❌ Firebase initialization error: $e');
    debugPrint('Stack trace: $stackTrace');
    // Continue anyway - app will handle missing Firebase gracefully
  }

  debugPrint('🎯 Running app...');
  runApp(const PasakayApp());
}

class PasakayApp extends StatelessWidget {
  const PasakayApp({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ).copyWith(
      secondary: AppColors.secondary,
      error: AppColors.error,
    );
    final textTheme = GoogleFonts.poppinsTextTheme(
      Typography.material2021().black,
    ).apply(
      bodyColor: AppColors.textPrimary,
      displayColor: AppColors.textPrimary,
    );

    return WithForegroundTask(
      child: MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => TripProvider()),
          ChangeNotifierProvider(create: (_) => DriverProvider()),
        ],
        child: MaterialApp(
          navigatorKey: NotificationNavigationService.navigatorKey,
          title: AppConstants.appName,
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: colorScheme,
            textTheme: textTheme,
            fontFamily: GoogleFonts.poppins().fontFamily,
            scaffoldBackgroundColor: colorScheme.surface,
            appBarTheme: AppBarTheme(
              backgroundColor: colorScheme.surface,
              foregroundColor: colorScheme.onSurface,
              elevation: 0,
              centerTitle: true,
              systemOverlayStyle: const SystemUiOverlayStyle(
                statusBarColor: Colors.transparent,
                statusBarIconBrightness: Brightness.dark,
                statusBarBrightness: Brightness.light,
              ),
            ),
            elevatedButtonTheme: ElevatedButtonThemeData(
              style: ElevatedButton.styleFrom(
                backgroundColor: colorScheme.primary,
                foregroundColor: colorScheme.onPrimary,
                minimumSize: const Size(double.infinity, AppDimensions.buttonHeight),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppDimensions.borderRadius),
                ),
                textStyle: AppTextStyles.button,
              ),
            ),
            filledButtonTheme: FilledButtonThemeData(
              style: FilledButton.styleFrom(
                backgroundColor: colorScheme.primary,
                foregroundColor: colorScheme.onPrimary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppDimensions.borderRadius),
                ),
              ),
            ),
            outlinedButtonTheme: OutlinedButtonThemeData(
              style: OutlinedButton.styleFrom(
                foregroundColor: colorScheme.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppDimensions.borderRadius),
                ),
                side: BorderSide(color: colorScheme.outline),
              ),
            ),
            textButtonTheme: TextButtonThemeData(
              style: TextButton.styleFrom(
                foregroundColor: colorScheme.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppDimensions.borderRadius),
                ),
              ),
            ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: colorScheme.surfaceContainerHighest,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppDimensions.borderRadius),
                borderSide: BorderSide(color: colorScheme.outline),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppDimensions.borderRadius),
                borderSide: BorderSide(color: colorScheme.outline),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppDimensions.borderRadius),
                borderSide: BorderSide(color: colorScheme.primary, width: 2),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppDimensions.borderRadius),
                borderSide: BorderSide(color: colorScheme.error),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppDimensions.paddingMedium,
                vertical: AppDimensions.paddingMedium,
              ),
            ),
            cardTheme: CardTheme(
              color: colorScheme.surface,
              elevation: AppDimensions.cardElevation,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppDimensions.borderRadius),
              ),
            ),
            chipTheme: ChipThemeData(
              backgroundColor: colorScheme.surfaceContainerHighest,
              labelStyle: textTheme.labelLarge?.copyWith(color: colorScheme.onSurfaceVariant),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppDimensions.borderRadiusSmall),
                side: BorderSide(color: colorScheme.outline),
              ),
            ),
            dividerTheme: DividerThemeData(
              color: colorScheme.outlineVariant,
              thickness: 1,
            ),
            dialogTheme: DialogTheme(
              backgroundColor: const Color(0xFFFDFDFC),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(22),
              ),
              titleTextStyle: textTheme.titleLarge?.copyWith(
                color: const Color(0xFF29373A),
                fontWeight: FontWeight.w700,
              ),
              contentTextStyle: textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF6D7C7E),
              ),
            ),
            bottomSheetTheme: BottomSheetThemeData(
              backgroundColor: const Color(0xFFFDFDFC),
              modalBackgroundColor: const Color(0xFFFDFDFC),
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.vertical(
                  top: Radius.circular(26),
                ),
              ),
            ),
            snackBarTheme: SnackBarThemeData(
              backgroundColor: colorScheme.inverseSurface,
              contentTextStyle: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onInverseSurface,
              ),
              actionTextColor: colorScheme.inversePrimary,
            ),
            floatingActionButtonTheme: FloatingActionButtonThemeData(
              backgroundColor: colorScheme.primary,
              foregroundColor: colorScheme.onPrimary,
            ),
            navigationBarTheme: NavigationBarThemeData(
              backgroundColor: colorScheme.surface,
              indicatorColor: colorScheme.secondaryContainer,
              labelTextStyle: WidgetStateProperty.resolveWith(
                (states) => textTheme.labelMedium?.copyWith(
                  color: states.contains(WidgetState.selected)
                      ? colorScheme.onSecondaryContainer
                      : colorScheme.onSurfaceVariant,
                ),
              ),
              iconTheme: WidgetStateProperty.resolveWith(
                (states) => IconThemeData(
                  color: states.contains(WidgetState.selected)
                      ? colorScheme.onSecondaryContainer
                      : colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            bottomNavigationBarTheme: BottomNavigationBarThemeData(
              backgroundColor: colorScheme.surface,
              selectedItemColor: colorScheme.primary,
              unselectedItemColor: colorScheme.onSurfaceVariant,
              type: BottomNavigationBarType.fixed,
            ),
        ),
          home: const AppUpdateGate(
            child: SplashScreen(),
          ),
        ),
      ),
    );
  }
}

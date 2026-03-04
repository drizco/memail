import 'package:flutter/material.dart';
import 'screens/home_screen.dart';
import 'screens/settings_screen.dart';

void main() {
  runApp(const MEmailApp());
}

class MEmailApp extends StatelessWidget {
  const MEmailApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MEmail',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFE52929)),
        useMaterial3: true,
        scaffoldBackgroundColor: Colors.white,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF222222),
          elevation: 0,
          scrolledUnderElevation: 0.5,
        ),
      ),
      initialRoute: '/',
      routes: {
        '/': (_) => const HomeScreen(),
        '/settings': (_) => const SettingsScreen(),
      },
    );
  }
}

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:pasakay/screens/passenger/passenger_shell_theme.dart';
import 'package:pasakay/services/app_version_service.dart';
import 'package:pasakay/utils/constants.dart';

class AppUpdateGate extends StatefulWidget {
  final Widget child;

  const AppUpdateGate({
    super.key,
    required this.child,
  });

  @override
  State<AppUpdateGate> createState() => _AppUpdateGateState();
}

class _AppUpdateGateState extends State<AppUpdateGate> {
  final AppVersionService _versionService = AppVersionService();
  AppUpdateState? _updateState;
  bool _isChecking = true;
  bool _optionalPromptShown = false;

  @override
  void initState() {
    super.initState();
    _checkForUpdate();
  }

  Future<void> _checkForUpdate() async {
    try {
      final state = await _versionService.getPassengerUpdateState();
      if (!mounted) return;
      setState(() {
        _updateState = state;
        _isChecking = false;
      });
      _showOptionalPromptIfNeeded(state);
    } catch (_) {
      if (!mounted) return;
      setState(() => _isChecking = false);
    }
  }

  Future<void> _openUpdateUrl() async {
    final configUrl = _updateState?.config?.downloadUrl.trim() ?? '';
    final fallbackUrl =
        'https://play.google.com/store/apps/details?id=${_updateState?.packageInfo.packageName ?? 'com.pasakay.app'}';
    final uri = Uri.parse(configUrl.isNotEmpty ? configUrl : fallbackUrl);

    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _showOptionalPromptIfNeeded(AppUpdateState state) {
    if (_optionalPromptShown || !state.hasOptionalUpdate || state.mustUpdate) return;
    _optionalPromptShown = true;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Update available'),
          content: Text(
            state.config?.releaseNotes.trim().isNotEmpty == true
                ? state.config!.releaseNotes
                : 'A newer version of PaSakay is available.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Later'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.of(context).pop();
                _openUpdateUrl();
              },
              child: const Text('Update'),
            ),
          ],
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = _updateState;
    if (_isChecking) {
      return const Scaffold(
        backgroundColor: PassengerShellTheme.pageBackground,
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(
              PassengerShellTheme.heroBottom,
            ),
          ),
        ),
      );
    }

    if (state != null && state.mustUpdate) {
      return _ForceUpdateScreen(
        state: state,
        onUpdate: _openUpdateUrl,
      );
    }

    return widget.child;
  }
}

class _ForceUpdateScreen extends StatelessWidget {
  final AppUpdateState state;
  final VoidCallback onUpdate;

  const _ForceUpdateScreen({
    required this.state,
    required this.onUpdate,
  });

  @override
  Widget build(BuildContext context) {
    final config = state.config;
    final targetVersion = config?.latestVersion.isNotEmpty == true
        ? config!.latestVersion
        : config?.minVersion ?? '';

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: PassengerShellTheme.pageBackground,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 86,
                  height: 86,
                  decoration: BoxDecoration(
                    color: PassengerShellTheme.accentCream,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: PassengerShellTheme.heroBottom.withOpacity(0.18),
                    ),
                  ),
                  child: const Icon(
                    Icons.system_update_rounded,
                    color: PassengerShellTheme.heroBottom,
                    size: 42,
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  'Update required',
                  textAlign: TextAlign.center,
                  style: AppTextStyles.heading2.copyWith(
                    color: PassengerShellTheme.inkDark,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Please update PaSakay to continue using the latest version.',
                  textAlign: TextAlign.center,
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: PassengerShellTheme.mutedInk,
                  ),
                ),
                if (config?.releaseNotes.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: PassengerShellTheme.surfaceWhite,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: PassengerShellTheme.inkDark.withOpacity(0.08),
                      ),
                    ),
                    child: Text(
                      config!.releaseNotes,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: PassengerShellTheme.mutedInk,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                Text(
                  targetVersion.isEmpty
                      ? 'Installed: ${state.currentVersion}+${state.currentBuildNumber}'
                      : 'Installed: ${state.currentVersion}+${state.currentBuildNumber}  Latest: $targetVersion',
                  textAlign: TextAlign.center,
                  style: AppTextStyles.caption.copyWith(
                    color: PassengerShellTheme.mutedInk,
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: onUpdate,
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text('Update from Play Store'),
                  style: FilledButton.styleFrom(
                    backgroundColor: PassengerShellTheme.heroBottom,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

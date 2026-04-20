import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/services.dart';

class AppVersionConfig {
  final String latestVersion;
  final String minVersion;
  final int latestBuildNumber;
  final int minBuildNumber;
  final String downloadUrl;
  final String releaseNotes;
  final bool forceUpdate;

  const AppVersionConfig({
    required this.latestVersion,
    required this.minVersion,
    required this.latestBuildNumber,
    required this.minBuildNumber,
    required this.downloadUrl,
    required this.releaseNotes,
    required this.forceUpdate,
  });

  factory AppVersionConfig.fromJson(Map<dynamic, dynamic> json) {
    return AppVersionConfig(
      latestVersion: json['latestVersion']?.toString() ?? '',
      minVersion: json['minVersion']?.toString() ?? '',
      latestBuildNumber: _parseInt(json['latestBuildNumber']),
      minBuildNumber: _parseInt(json['minBuildNumber']),
      downloadUrl: json['downloadUrl']?.toString() ?? '',
      releaseNotes: json['releaseNotes']?.toString() ?? '',
      forceUpdate: json['forceUpdate'] == true ||
          json['forceUpdate']?.toString().toLowerCase() == 'true',
    );
  }

  static int _parseInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class AppUpdateState {
  final AppPackageInfo packageInfo;
  final AppVersionConfig? config;

  const AppUpdateState({
    required this.packageInfo,
    required this.config,
  });

  int get currentBuildNumber => int.tryParse(packageInfo.buildNumber) ?? 0;
  String get currentVersion => packageInfo.version;

  bool get hasConfig => config != null;

  bool get mustUpdate {
    final remote = config;
    if (remote == null) return false;
    if (!remote.forceUpdate) return false;
    if (remote.minBuildNumber > 0) {
      return currentBuildNumber < remote.minBuildNumber;
    }
    if (remote.minVersion.isEmpty) return false;
    return _compareVersions(currentVersion, remote.minVersion) < 0;
  }

  bool get hasOptionalUpdate {
    final remote = config;
    if (remote == null || mustUpdate) return false;
    if (remote.latestBuildNumber > 0) {
      return currentBuildNumber < remote.latestBuildNumber;
    }
    if (remote.latestVersion.isEmpty) return false;
    return _compareVersions(currentVersion, remote.latestVersion) < 0;
  }

  static int _compareVersions(String current, String required) {
    final currentParts = current.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final requiredParts = required.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final maxLength = currentParts.length > requiredParts.length
        ? currentParts.length
        : requiredParts.length;

    for (var i = 0; i < maxLength; i++) {
      final currentPart = i < currentParts.length ? currentParts[i] : 0;
      final requiredPart = i < requiredParts.length ? requiredParts[i] : 0;
      if (currentPart != requiredPart) {
        return currentPart.compareTo(requiredPart);
      }
    }
    return 0;
  }
}

class AppPackageInfo {
  final String packageName;
  final String version;
  final String buildNumber;

  const AppPackageInfo({
    required this.packageName,
    required this.version,
    required this.buildNumber,
  });
}

class AppVersionService {
  static const MethodChannel _channel = MethodChannel('com.pasakay.app/wakelock');
  final DatabaseReference _database = FirebaseDatabase.instance.ref();

  Future<AppUpdateState> getPassengerUpdateState() async {
    final packageInfo = await _getPackageInfo();
    AppVersionConfig? config;

    final snapshot = await _database.child('app_config').child('passenger').get();
    if (snapshot.exists && snapshot.value is Map) {
      config = AppVersionConfig.fromJson(snapshot.value as Map<dynamic, dynamic>);
    }

    return AppUpdateState(
      packageInfo: packageInfo,
      config: config,
    );
  }

  Future<AppPackageInfo> _getPackageInfo() async {
    try {
      final result = await _channel.invokeMapMethod<String, dynamic>('getPackageInfo');
      return AppPackageInfo(
        packageName: result?['packageName']?.toString() ?? 'com.pasakay.app',
        version: result?['versionName']?.toString() ?? '1.0.0',
        buildNumber: result?['versionCode']?.toString() ?? '1',
      );
    } catch (_) {
      return const AppPackageInfo(
        packageName: 'com.pasakay.app',
        version: '1.0.0',
        buildNumber: '1',
      );
    }
  }
}

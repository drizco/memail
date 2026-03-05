import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/history_entry.dart';

const _historyKey = '@memail_history';
const _maxHistory = 500;

Future<List<HistoryEntry>> getHistory() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString(_historyKey);
  if (raw == null) return [];
  final List<dynamic> decoded = jsonDecode(raw);
  return decoded
      .map((e) => HistoryEntry.fromJson(e as Map<String, dynamic>))
      .toList();
}

Future<void> addHistoryEntry(HistoryEntry entry) async {
  final history = await getHistory();
  history.insert(0, entry);
  if (history.length > _maxHistory) {
    history.removeRange(_maxHistory, history.length);
  }
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(
      _historyKey, jsonEncode(history.map((e) => e.toJson()).toList()));
}

Future<void> deleteHistoryEntry(String id) async {
  final history = await getHistory();
  history.removeWhere((e) => e.id == id);
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(
      _historyKey, jsonEncode(history.map((e) => e.toJson()).toList()));
}

Future<void> clearHistory() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_historyKey);
}

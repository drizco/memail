import 'dart:convert';
import 'package:http/http.dart' as http;

const _apiUrl =
    'https://us-central1-memail-163415.cloudfunctions.net/sendMeMail';

Future<bool> sendMeMail(String idToken, String title, String url) async {
  try {
    final response = await http.post(
      Uri.parse(_apiUrl),
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': 'Bearer $idToken',
      },
      body: jsonEncode({'title': title, 'url': url}),
    );
    return response.body == 'success';
  } catch (_) {
    return false;
  }
}

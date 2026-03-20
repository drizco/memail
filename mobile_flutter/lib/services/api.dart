import 'dart:convert';
import 'package:http/http.dart' as http;

const _apiUrl =
    'https://api.memail.drizco.dev/send';

Future<bool> sendMeMail(String idToken, String url) async {
  try {
    final response = await http.post(
      Uri.parse(_apiUrl),
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': 'Bearer $idToken',
      },
      body: jsonEncode({'url': url}),
    );
    return response.body == 'success';
  } catch (_) {
    return false;
  }
}

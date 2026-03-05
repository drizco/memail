import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

final _googleSignIn = GoogleSignIn();
final _firebaseAuth = FirebaseAuth.instance;

User? getCurrentUser() => _firebaseAuth.currentUser;

Stream<User?> authStateChanges() => _firebaseAuth.authStateChanges();

Future<String?> getIdToken() async {
  final user = _firebaseAuth.currentUser;
  if (user == null) return null;
  return user.getIdToken();
}

Future<User> signIn() async {
  final googleUser = await _googleSignIn.signIn();
  if (googleUser == null) throw Exception('Sign-in cancelled');

  final googleAuth = await googleUser.authentication;
  final credential = GoogleAuthProvider.credential(
    idToken: googleAuth.idToken,
    accessToken: googleAuth.accessToken,
  );

  final userCredential = await _firebaseAuth.signInWithCredential(credential);
  return userCredential.user!;
}

Future<void> signOut() async {
  await _googleSignIn.signOut();
  await _firebaseAuth.signOut();
}

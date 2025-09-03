
// src/lib/firebase/admin.ts
import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

const serviceAccount = {
  "type": "service_account",
  "project_id": "siskamling-digital",
  "private_key_id": "e3747acfb808e3d5e7746f0a972ae9b9b1521ff5",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCnJSziHRxKCVWW\nmuy9Vk/J2CLvsMQWBZ4xYEFnSVFX1Rul6RdElDS9j4cEC3rK5LCYZ5tCElLZRESX\ntHpv+GC4nFreCWsTBklkLMdHBcpNyJo9KqHsyZeiqxIWyu4O3csX71SNtqQsHOky\n1qwAWOHzrCjS9mVuZMm0JNKGvsIcC812licjPRJ/69bvJcT/G7E12wLXRM2giMla\nHWWvQIc2jUQjiz7w/ROya4wHmGV7D/rWgO//0skyfa+9ppypZNyQGk5q+iKEwgrS\n+ocMjR4N+kws80H4hYmUzlGcXPg9ft1uaQah+/79cSlEi6UHli/c6fU4emynWZ5L\nZiqbbH9xAgMBAAECggEAHqktIJVieRpZPvVQdDL/E/G4BuwQLFH/gOM9XCsQ5uHK\n3pZxlDzzp8pKZC2O6uUkl/B5hJdD52MkigerZhrT80mLSavEnorKr7ufGqIvSDGC\nSbImXf9k94wWF2RGYyfAd7WJdy2H1CfBh3fluXKUkFSGcJyOYr/OWGNg0yLvDKG5\nbNSKj1kljsceILpG0KnNBLhyNJzT2UbG3KhnMcWHa83y8Z5TaLjFU8/vTUEc8d2k\nooSvaQe1jTFDGJkqdf8HCxtzbMjzCVZv/al4tyqA0jE3aANXpgXF9OZQdKHK9D/i\ngZfGUH8V53yNLRN7QDFUG9qgsk4k3iJMtE0wfdHvoQKBgQDifaWwgrRCP+2t3Rto\nH+LIuUo3O85AR6lBwj61+wFOSJfCgwhRIE9sUluobjB3ZWlWma8GOmbSnZEapoGH\nJPbJwKIsPNI2vtHWX3KFLb6PFvjfTuD1s8r7P2JcEXOTL0NLfdnurtf8rYjcZLzz\n7Vszkp8Jk5q2MrsCRNynSgLvbQKBgQC87B7wxgTFAhjjA/pGJviQRkbMm1sdgd9m\nIXJYGHwvECvKdnMQathefmaeSEQQ8ZvFU1I77j2HfdLlM9gPs1S2DLN9nOu/QxMk\nTt+7VH7rBs4dVBGJ3Xa2evqlB7DjdSbFUAleC3i1jimIKl2yg8uRPWpL6r5tEcoI\nMBA0KruZlQKBgBd6wxR7WEiN7AvcIh03QQFiBAmZz5XmV+uTQYEIFmiRKfpmLxSJ\n7vHhz9K0KZ4XC0aJBBX3M/WdlA9ZN5BVCqh7qdRAMeKvAX3hwzN/PIQE86Piv3t5\nOg+10HKO9JZLjgRjdZZC1e1B6DBA2T3IW24LQyVxAdblh3GCxgUprQg5AoGACIEA\na4oeUNflUuKs81dxvNzM9wzPLybXbXt38Cs5+8xYjEaEq2qDzs0VxW4vUivt/RXh\nD72Lm3u4cITC5wIFgCRWOANGQVe9ltbOD1qgU+f8gylzmKcVXuVuPtt3xOVTF3Kg\n2VDe4B1EFVMC4LQ6B5GiJUStya8RTwkK0a5Sv3kCgYAEnRVYXNmMrfn/QCgEVpC5\nqtYuojmDOhbyIq9GxHnehb5qi2U8TE3x4G58T3WJZUChumnbBE4mIr1cJLbl9mX6\nZ91hhVXyW0SE3VqWSG6tICECU6Uy0I95q/gSoe7hgqhyg6wg7bwRvdje0xeOM9S5\nDIbDw0H6ZL6TrKRplmXOsw==\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
  "client_email": "firebase-adminsdk-fbsvc@siskamling-digital.iam.gserviceaccount.com",
  "client_id": "113306620471290752465",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40siskamling-digital.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

if (!getApps().length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://siskamling-digital-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
}

const adminDb = admin.firestore();

export { adminDb };

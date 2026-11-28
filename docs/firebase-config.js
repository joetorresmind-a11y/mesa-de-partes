// La configuracion web de Firebase es publica por diseno.
// La seguridad real se aplica mediante firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyCsohQHOkGViAvfHh72D97r8a50cBv2IrM",
  authDomain: "mesa-de-partes-53521.firebaseapp.com",
  projectId: "mesa-de-partes-53521",
  messagingSenderId: "96059315999",
  appId: "1:96059315999:web:a5742d1471cf96da4f422a",
  measurementId: "G-NCMGRS8SDS"
};

// El usuario escribe "joel" en el formulario. Firebase Authentication
// utiliza este correo interno para identificar la cuenta administrativa.
export const ADMIN_USERNAME = "joel";
export const ADMIN_EMAIL = "joel@mesa-de-partes-53521.firebaseapp.com";

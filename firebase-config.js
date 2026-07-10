// ===================================================================
// Configuração do Firebase
// Substitua pelos dados do SEU projeto (Console Firebase > Configurações
// do projeto > Seus apps > Config). Pode ser um projeto novo, dedicado
// só para este sistema de igrejas — recomendado não misturar com o
// projeto "interliga-app".
// ===================================================================

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

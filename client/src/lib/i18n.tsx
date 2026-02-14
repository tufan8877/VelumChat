import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export const languages = {
  en: "English",
  de: "Deutsch",
  ru: "Русский",
  fr: "Français",
  es: "Español",
  tr: "Türkçe",
} as const;

export type Language = keyof typeof languages;

type Params = Record<string, string>;

// ✅ Base schema: only keys you actively use (and can expand anytime)
// This avoids “massive file” issues but keeps everything stable.
type TranslationSchema = {
  // Common
  error: string;
  success: string;
  saving: string;
  deleting: string;
  blocking: string;

  // Welcome / Auth
  welcome: string;
  welcomeDescription: string;
  createAccount: string;
  login: string;
  username: string;
  password: string;
  chooseUsername: string;
  chooseUsernameHint: string;
  usernameRequired: string;
  enterUsername: string;
  usernameTooShort: string;
  usernameMinLength: string;

  loginSuccess: string;
  loginFailed: string;
  passwordRequired: string;
  enterPassword: string;
  passwordTooShort: string;
  passwordMinLength: string;
  accountCreated: string;
  registrationFailed: string;
  accountCreationFailed: string;
  noPhoneRequired: string;
  selfDestructing: string;
  zeroDataRetention: string;
  chooseIdentity: string;
  enterCredentials: string;
  features: string;

  // Chat
  searchUsers: string;
  searchChats: string;
  startChat: string;
  typeMessage: string;
  sendMessage: string;
  online: string;
  offline: string;
  connecting: string;
  connected: string;
  disconnected: string;
  realTimeChat: string;
  encryptedChat: string;
  loadingChats: string;
  noChats: string;
  noChatDescription: string;
  selectChatToStart: string;
  welcomeToWhispergram: string;

  notConnected: string;
  selectChatFirst: string;
  fileTooLarge: string;
  failedToReadFile: string;
  selectChatPhoto: string;

  now: string;

  // Settings
  settingsTitle: string;
  profile: string;
  saveProfile: string;
  usernameLabel: string;
  usernameDescription: string;
  enterNewUsername: string;
  language: string;
  about: string;
  aboutText: string;

  profileSaved: string;
  profileSaveError: string;
  usernameEmpty: string;
  usernameExists: string;
  usernameTaken: string;
  usernameUpdated: string;

  tokenMissing: string;

  // Account deletion
  deleteAccount: string;
  deleteAccountTitle: string;
  deleteAccountDescription: string;
  deleteAccountConfirm: string;
  deleteAccountForever: string;
  accountDeleted: string;
  accountDeletedDesc: string;
  accountDeleteError: string;
};

const base: Record<Language, TranslationSchema> = {
  en: {
    // Common
    error: "Error",
    success: "Success",
    saving: "Saving...",
    deleting: "Deleting...",
    blocking: "Blocking...",

    // Welcome / Auth
    welcome: "Welcome to Velumchat",
    welcomeDescription: "Secure, anonymous messaging with end-to-end encryption",
    createAccount: "Create Account",
    login: "Login",
    username: "Username",
    password: "Password",
    chooseUsername: "Choose your username",
    chooseUsernameHint: "Pick any username you like (minimum 3 characters)",
    usernameRequired: "Username required",
    enterUsername: "Please enter a username",
    usernameTooShort: "Username too short",
    usernameMinLength: "Username must be at least 3 characters",

    loginSuccess: "Successfully logged in",
    loginFailed: "Invalid username or password",
    passwordRequired: "Password required",
    enterPassword: "Please enter a password",
    passwordTooShort: "Password too short",
    passwordMinLength: "Password must be at least 6 characters long",
    accountCreated: "Your secure identity has been created",
    registrationFailed: "Registration Failed",
    accountCreationFailed: "Failed to create account",
    noPhoneRequired: "No phone or email required",
    selfDestructing: "Self-destructing messages",
    zeroDataRetention: "Zero data retention",
    chooseIdentity: "Choose Your Identity",
    enterCredentials: "Enter your existing username and password",
    features: "Features",

    // Chat
    searchUsers: "Search users...",
    searchChats: "Search chats...",
    startChat: "Start Chat",
    typeMessage: "Type a message...",
    sendMessage: "Send",
    online: "Online",
    offline: "Offline",
    connecting: "Connecting...",
    connected: "Connected",
    disconnected: "Disconnected",
    realTimeChat: "Real-time chat",
    encryptedChat: "Encrypted Chat",
    loadingChats: "Loading chats...",
    noChats: "No chats yet",
    noChatDescription: "Search for users to start encrypted chats",
    selectChatToStart: "Select a chat to start secure messaging",
    welcomeToWhispergram: "Welcome to Whispergram",

    notConnected: "Not connected! Please wait for connection to be established.",
    selectChatFirst: "Please select a chat and ensure you're connected before uploading files.",
    fileTooLarge: "File too large! Maximum size is 10MB.",
    failedToReadFile: "Failed to read image file",
    selectChatPhoto: "Please select a chat and ensure you're connected before taking photos.",

    now: "now",

    // Settings
    settingsTitle: "Settings",
    profile: "Profile",
    saveProfile: "Save Profile",
    usernameLabel: "Username",
    usernameDescription:
      'Simply enter a new name and click "Save Profile". Your username is your anonymous identity.',
    enterNewUsername: "Enter your new username",
    language: "Language",
    about: "About",
    aboutText: "VelumChat – end-to-end encrypted messaging.",

    profileSaved: "Profile saved successfully!",
    profileSaveError: "Failed to save profile. Please try again.",
    usernameEmpty: "Username cannot be empty",
    usernameExists: "Username already taken",
    usernameTaken: "Username is already taken",
    usernameUpdated: "Username updated successfully",

    tokenMissing: "Token missing — please log in again.",

    // Account deletion
    deleteAccount: "Delete Account",
    deleteAccountTitle: "Delete Account",
    deleteAccountDescription: "Permanently delete your account and all data",
    deleteAccountConfirm:
      "Are you sure you want to permanently delete your account?\n\nThis will delete:\n- your user\n- all chats\n- all messages\n\nYour username will be available again.",
    deleteAccountForever: "Delete Forever",
    accountDeleted: "Account successfully deleted",
    accountDeletedDesc: "Your profile and all content have been deleted.",
    accountDeleteError: "Failed to delete account",
  },

  de: {
    // Common
    error: "Fehler",
    success: "Erfolg",
    saving: "Speichern...",
    deleting: "Wird gelöscht...",
    blocking: "Wird blockiert...",

    // Welcome / Auth
    welcome: "Willkommen bei Velumchat",
    welcomeDescription: "Sichere, anonyme Nachrichten mit Ende-zu-Ende-Verschlüsselung",
    createAccount: "Konto erstellen",
    login: "Anmelden",
    username: "Benutzername",
    password: "Passwort",
    chooseUsername: "Wählen Sie Ihren Benutzernamen",
    chooseUsernameHint: "Wählen Sie einen beliebigen Benutzernamen (mindestens 3 Zeichen)",
    usernameRequired: "Benutzername erforderlich",
    enterUsername: "Bitte geben Sie einen Benutzernamen ein",
    usernameTooShort: "Benutzername zu kurz",
    usernameMinLength: "Benutzername muss mindestens 3 Zeichen lang sein",

    loginSuccess: "Erfolgreich angemeldet",
    loginFailed: "Ungültiger Benutzername oder Passwort",
    passwordRequired: "Passwort erforderlich",
    enterPassword: "Bitte geben Sie ein Passwort ein",
    passwordTooShort: "Passwort zu kurz",
    passwordMinLength: "Passwort muss mindestens 6 Zeichen lang sein",
    accountCreated: "Ihre sichere Identität wurde erstellt",
    registrationFailed: "Registrierung fehlgeschlagen",
    accountCreationFailed: "Konto konnte nicht erstellt werden",
    noPhoneRequired: "Keine Telefonnummer oder E-Mail erforderlich",
    selfDestructing: "Selbstzerstörende Nachrichten",
    zeroDataRetention: "Keine Datenspeicherung",
    chooseIdentity: "Wählen Sie Ihre Identität",
    enterCredentials: "Geben Sie Ihren vorhandenen Benutzernamen und Ihr Passwort ein",
    features: "Funktionen",

    // Chat
    searchUsers: "Benutzer suchen...",
    searchChats: "Chats durchsuchen...",
    startChat: "Chat starten",
    typeMessage: "Nachricht eingeben...",
    sendMessage: "Senden",
    online: "Online",
    offline: "Offline",
    connecting: "Verbindung...",
    connected: "Verbunden",
    disconnected: "Getrennt",
    realTimeChat: "Echtzeit-Chat",
    encryptedChat: "Verschlüsselter Chat",
    loadingChats: "Lade Chats...",
    noChats: "Noch keine Chats",
    noChatDescription: "Suchen Sie nach Benutzern um verschlüsselte Chats zu starten",
    selectChatToStart: "Wähle einen Chat für sichere Nachrichten",
    welcomeToWhispergram: "Willkommen bei Whispergram",

    notConnected: "Nicht verbunden! Bitte warten Sie, bis die Verbindung hergestellt ist.",
    selectChatFirst: "Bitte wählen Sie einen Chat und stellen Sie sicher, dass Sie verbunden sind, bevor Sie Dateien hochladen.",
    fileTooLarge: "Datei zu groß! Maximale Größe ist 10MB.",
    failedToReadFile: "Fehler beim Lesen der Bilddatei",
    selectChatPhoto: "Bitte wählen Sie einen Chat und stellen Sie sicher, dass Sie verbunden sind, bevor Sie Fotos aufnehmen.",

    now: "jetzt",

    // Settings
    settingsTitle: "Einstellungen",
    profile: "Profil",
    saveProfile: "Profil speichern",
    usernameLabel: "Benutzername",
    usernameDescription:
      'Geben Sie einfach einen neuen Namen ein und klicken Sie auf "Profil speichern". Ihr Benutzername ist Ihre anonyme Identität.',
    enterNewUsername: "Geben Sie Ihren neuen Benutzernamen ein",
    language: "Sprache",
    about: "Über",
    aboutText: "VelumChat – Ende-zu-Ende verschlüsselte Nachrichten.",

    profileSaved: "Profil erfolgreich gespeichert!",
    profileSaveError: "Profil konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    usernameEmpty: "Benutzername darf nicht leer sein",
    usernameExists: "Benutzername bereits vergeben",
    usernameTaken: "Benutzername bereits vergeben",
    usernameUpdated: "Username wurde aktualisiert.",

    tokenMissing: "Token fehlt – bitte neu einloggen.",

    // Account deletion
    deleteAccount: "Account löschen",
    deleteAccountTitle: "Account löschen",
    deleteAccountDescription: "Account und alle Daten permanent löschen",
    deleteAccountConfirm:
      "Willst du dein Profil wirklich löschen?\n\nDas löscht:\n- deinen User\n- alle Chats\n- alle Nachrichten\n\nDein Username wird danach wieder frei.",
    deleteAccountForever: "Endgültig löschen",
    accountDeleted: "Account erfolgreich gelöscht",
    accountDeletedDesc: "Dein Profil und alle Inhalte wurden gelöscht.",
    accountDeleteError: "Fehler beim Löschen des Accounts",
  },

  ru: {
    // Common
    error: "Ошибка",
    success: "Успех",
    saving: "Сохранение...",
    deleting: "Удаление...",
    blocking: "Блокировка...",

    // Welcome / Auth
    welcome: "Добро пожаловать в Velumchat",
    welcomeDescription: "Безопасные анонимные сообщения со сквозным шифрованием",
    createAccount: "Создать аккаунт",
    login: "Войти",
    username: "Имя пользователя",
    password: "Пароль",
    chooseUsername: "Выберите имя пользователя",
    chooseUsernameHint: "Выберите любое имя (минимум 3 символа)",
    usernameRequired: "Требуется имя пользователя",
    enterUsername: "Пожалуйста, введите имя пользователя",
    usernameTooShort: "Имя пользователя слишком короткое",
    usernameMinLength: "Имя пользователя должно быть минимум 3 символа",

    loginSuccess: "Вход выполнен успешно",
    loginFailed: "Неверное имя пользователя или пароль",
    passwordRequired: "Требуется пароль",
    enterPassword: "Введите пароль",
    passwordTooShort: "Пароль слишком короткий",
    passwordMinLength: "Пароль должен быть не менее 6 символов",
    accountCreated: "Ваша безопасная личность создана",
    registrationFailed: "Регистрация не удалась",
    accountCreationFailed: "Не удалось создать аккаунт",
    noPhoneRequired: "Телефон или email не требуется",
    selfDestructing: "Самоуничтожающиеся сообщения",
    zeroDataRetention: "Нулевое хранение данных",
    chooseIdentity: "Выберите свою личность",
    enterCredentials: "Введите существующее имя пользователя и пароль",
    features: "Возможности",

    // Chat
    searchUsers: "Поиск пользователей...",
    searchChats: "Поиск чатов...",
    startChat: "Начать чат",
    typeMessage: "Введите сообщение...",
    sendMessage: "Отправить",
    online: "В сети",
    offline: "Не в сети",
    connecting: "Подключение...",
    connected: "Подключено",
    disconnected: "Отключено",
    realTimeChat: "Чат в реальном времени",
    encryptedChat: "Зашифрованный чат",
    loadingChats: "Загрузка чатов...",
    noChats: "Пока нет чатов",
    noChatDescription: "Найдите пользователей для зашифрованных чатов",
    selectChatToStart: "Выберите чат для безопасного общения",
    welcomeToWhispergram: "Добро пожаловать в Whispergram",

    notConnected: "Нет соединения! Подождите, пока соединение установится.",
    selectChatFirst: "Выберите чат и убедитесь, что вы подключены, прежде чем загружать файлы.",
    fileTooLarge: "Файл слишком большой! Максимум 10MB.",
    failedToReadFile: "Не удалось прочитать файл изображения",
    selectChatPhoto: "Выберите чат и убедитесь, что вы подключены, прежде чем делать фото.",

    now: "сейчас",

    // Settings
    settingsTitle: "Настройки",
    profile: "Профиль",
    saveProfile: "Сохранить профиль",
    usernameLabel: "Имя пользователя",
    usernameDescription:
      'Введите новое имя и нажмите "Сохранить профиль". Имя пользователя — ваша анонимная личность.',
    enterNewUsername: "Введите новое имя пользователя",
    language: "Язык",
    about: "О программе",
    aboutText: "VelumChat — обмен сообщениями со сквозным шифрованием.",

    profileSaved: "Профиль успешно сохранён!",
    profileSaveError: "Не удалось сохранить профиль. Попробуйте ещё раз.",
    usernameEmpty: "Имя пользователя не может быть пустым",
    usernameExists: "Имя пользователя уже занято",
    usernameTaken: "Имя пользователя уже занято",
    usernameUpdated: "Имя пользователя успешно обновлено",

    tokenMissing: "Отсутствует токен — пожалуйста, войдите снова.",

    // Account deletion
    deleteAccount: "Удалить аккаунт",
    deleteAccountTitle: "Удалить аккаунт",
    deleteAccountDescription: "Навсегда удалить аккаунт и все данные",
    deleteAccountConfirm:
      "Вы уверены, что хотите навсегда удалить аккаунт?\n\nЭто удалит:\n- ваш профиль\n- все чаты\n- все сообщения\n\nВаше имя пользователя снова станет доступным.",
    deleteAccountForever: "Удалить навсегда",
    accountDeleted: "Аккаунт успешно удалён",
    accountDeletedDesc: "Ваш профиль и весь контент были удалены.",
    accountDeleteError: "Не удалось удалить аккаунт",
  },

  fr: {
    // Common
    error: "Erreur",
    success: "Succès",
    saving: "Enregistrement...",
    deleting: "Suppression...",
    blocking: "Blocage...",

    // Welcome / Auth
    welcome: "Bienvenue sur Velumchat",
    welcomeDescription: "Messagerie sécurisée et anonyme avec chiffrement de bout en bout",
    createAccount: "Créer un compte",
    login: "Se connecter",
    username: "Nom d'utilisateur",
    password: "Mot de passe",
    chooseUsername: "Choisissez votre nom d'utilisateur",
    chooseUsernameHint: "Choisissez n'importe quel nom (minimum 3 caractères)",
    usernameRequired: "Nom d'utilisateur requis",
    enterUsername: "Veuillez entrer un nom d'utilisateur",
    usernameTooShort: "Nom d'utilisateur trop court",
    usernameMinLength: "Le nom d'utilisateur doit contenir au moins 3 caractères",

    loginSuccess: "Connexion réussie",
    loginFailed: "Nom d'utilisateur ou mot de passe invalide",
    passwordRequired: "Mot de passe requis",
    enterPassword: "Veuillez entrer un mot de passe",
    passwordTooShort: "Mot de passe trop court",
    passwordMinLength: "Le mot de passe doit contenir au moins 6 caractères",
    accountCreated: "Votre identité sécurisée a été créée",
    registrationFailed: "Échec de l'inscription",
    accountCreationFailed: "Impossible de créer le compte",
    noPhoneRequired: "Aucun téléphone ou email requis",
    selfDestructing: "Messages auto-destructeurs",
    zeroDataRetention: "Zéro rétention de données",
    chooseIdentity: "Choisissez votre identité",
    enterCredentials: "Entrez votre nom d'utilisateur et mot de passe existants",
    features: "Fonctionnalités",

    // Chat
    searchUsers: "Rechercher des utilisateurs...",
    searchChats: "Rechercher des conversations...",
    startChat: "Démarrer une conversation",
    typeMessage: "Tapez un message...",
    sendMessage: "Envoyer",
    online: "En ligne",
    offline: "Hors ligne",
    connecting: "Connexion...",
    connected: "Connecté",
    disconnected: "Déconnecté",
    realTimeChat: "Chat en temps réel",
    encryptedChat: "Chat chiffré",
    loadingChats: "Chargement des chats...",
    noChats: "Aucun chat",
    noChatDescription: "Recherchez des utilisateurs pour démarrer des chats chiffrés",
    selectChatToStart: "Sélectionnez un chat pour une messagerie sécurisée",
    welcomeToWhispergram: "Bienvenue sur Whispergram",

    notConnected: "Non connecté ! Veuillez attendre la connexion.",
    selectChatFirst: "Sélectionnez un chat et assurez-vous d'être connecté avant d'envoyer des fichiers.",
    fileTooLarge: "Fichier trop volumineux ! Maximum 10MB.",
    failedToReadFile: "Impossible de lire l'image",
    selectChatPhoto: "Sélectionnez un chat et assurez-vous d'être connecté avant de prendre des photos.",

    now: "maintenant",

    // Settings
    settingsTitle: "Paramètres",
    profile: "Profil",
    saveProfile: "Sauvegarder le profil",
    usernameLabel: "Nom d'utilisateur",
    usernameDescription:
      'Entrez un nouveau nom puis cliquez sur "Sauvegarder le profil". Votre nom d’utilisateur est votre identité anonyme.',
    enterNewUsername: "Entrez votre nouveau nom d'utilisateur",
    language: "Langue",
    about: "À propos",
    aboutText: "VelumChat — messagerie chiffrée de bout en bout.",

    profileSaved: "Profil sauvegardé avec succès !",
    profileSaveError: "Impossible de sauvegarder le profil. Veuillez réessayer.",
    usernameEmpty: "Le nom d'utilisateur ne peut pas être vide",
    usernameExists: "Nom d'utilisateur déjà pris",
    usernameTaken: "Le nom d'utilisateur est déjà pris",
    usernameUpdated: "Nom d'utilisateur mis à jour avec succès",

    tokenMissing: "Jeton manquant — veuillez vous reconnecter.",

    // Account deletion
    deleteAccount: "Supprimer le compte",
    deleteAccountTitle: "Supprimer le compte",
    deleteAccountDescription: "Supprimer définitivement votre compte et toutes les données",
    deleteAccountConfirm:
      "Êtes-vous sûr de vouloir supprimer définitivement votre compte ?\n\nCela supprimera :\n- votre profil\n- tous les chats\n- tous les messages\n\nVotre nom d'utilisateur redeviendra disponible.",
    deleteAccountForever: "Supprimer définitivement",
    accountDeleted: "Compte supprimé avec succès",
    accountDeletedDesc: "Votre profil et tout le contenu ont été supprimés.",
    accountDeleteError: "Échec de la suppression du compte",
  },

  es: {
    // Common
    error: "Error",
    success: "Éxito",
    saving: "Guardando...",
    deleting: "Eliminando...",
    blocking: "Bloqueando...",

    // Welcome / Auth
    welcome: "Bienvenido a Velumchat",
    welcomeDescription: "Mensajería segura y anónima con cifrado de extremo a extremo",
    createAccount: "Crear cuenta",
    login: "Iniciar sesión",
    username: "Nombre de usuario",
    password: "Contraseña",
    chooseUsername: "Elige tu nombre de usuario",
    chooseUsernameHint: "Elige cualquier nombre (mínimo 3 caracteres)",
    usernameRequired: "Se requiere nombre de usuario",
    enterUsername: "Por favor ingresa un nombre de usuario",
    usernameTooShort: "Nombre de usuario demasiado corto",
    usernameMinLength: "El nombre de usuario debe tener al menos 3 caracteres",

    loginSuccess: "Inicio de sesión exitoso",
    loginFailed: "Nombre de usuario o contraseña inválidos",
    passwordRequired: "Contraseña requerida",
    enterPassword: "Por favor ingresa una contraseña",
    passwordTooShort: "Contraseña muy corta",
    passwordMinLength: "La contraseña debe tener al menos 6 caracteres",
    accountCreated: "Tu identidad segura ha sido creada",
    registrationFailed: "Registro fallido",
    accountCreationFailed: "No se pudo crear la cuenta",
    noPhoneRequired: "No se requiere teléfono o email",
    selfDestructing: "Mensajes auto-destructivos",
    zeroDataRetention: "Cero retención de datos",
    chooseIdentity: "Elige tu identidad",
    enterCredentials: "Ingresa tu nombre de usuario y contraseña existentes",
    features: "Características",

    // Chat
    searchUsers: "Buscar usuarios...",
    searchChats: "Buscar chats...",
    startChat: "Iniciar chat",
    typeMessage: "Escribe un mensaje...",
    sendMessage: "Enviar",
    online: "En línea",
    offline: "Desconectado",
    connecting: "Conectando...",
    connected: "Conectado",
    disconnected: "Desconectado",
    realTimeChat: "Chat en tiempo real",
    encryptedChat: "Chat encriptado",
    loadingChats: "Cargando chats...",
    noChats: "Aún no hay chats",
    noChatDescription: "Busca usuarios para iniciar chats cifrados",
    selectChatToStart: "Selecciona un chat para mensajería segura",
    welcomeToWhispergram: "Bienvenido a Whispergram",

    notConnected: "¡No conectado! Espera a que se establezca la conexión.",
    selectChatFirst: "Selecciona un chat y asegúrate de estar conectado antes de subir archivos.",
    fileTooLarge: "¡Archivo demasiado grande! Máximo 10MB.",
    failedToReadFile: "No se pudo leer la imagen",
    selectChatPhoto: "Selecciona un chat y asegúrate de estar conectado antes de tomar fotos.",

    now: "ahora",

    // Settings
    settingsTitle: "Configuración",
    profile: "Perfil",
    saveProfile: "Guardar perfil",
    usernameLabel: "Nombre de usuario",
    usernameDescription:
      'Ingresa un nuevo nombre y haz clic en "Guardar perfil". Tu nombre de usuario es tu identidad anónima.',
    enterNewUsername: "Ingresa tu nuevo nombre de usuario",
    language: "Idioma",
    about: "Acerca de",
    aboutText: "VelumChat — mensajería cifrada de extremo a extremo.",

    profileSaved: "¡Perfil guardado exitosamente!",
    profileSaveError: "Error al guardar el perfil. Inténtalo de nuevo.",
    usernameEmpty: "El nombre de usuario no puede estar vacío",
    usernameExists: "El nombre de usuario ya existe",
    usernameTaken: "El nombre de usuario ya está tomado",
    usernameUpdated: "Nombre de usuario actualizado exitosamente",

    tokenMissing: "Falta el token — vuelve a iniciar sesión.",

    // Account deletion
    deleteAccount: "Eliminar cuenta",
    deleteAccountTitle: "Eliminar cuenta",
    deleteAccountDescription: "Eliminar permanentemente tu cuenta y todos los datos",
    deleteAccountConfirm:
      "¿Estás seguro de que quieres eliminar permanentemente tu cuenta?\n\nEsto eliminará:\n- tu perfil\n- todos los chats\n- todos los mensajes\n\nTu nombre de usuario volverá a estar disponible.",
    deleteAccountForever: "Eliminar para siempre",
    accountDeleted: "Cuenta eliminada exitosamente",
    accountDeletedDesc: "Tu perfil y todo el contenido han sido eliminados.",
    accountDeleteError: "Error al eliminar la cuenta",
  },

  tr: {
    // Common
    error: "Hata",
    success: "Başarılı",
    saving: "Kaydediliyor...",
    deleting: "Siliniyor...",
    blocking: "Engelleniyor...",

    // Welcome / Auth
    welcome: "Velumchat'a Hoş Geldiniz",
    welcomeDescription: "Uçtan uca şifrelemeli güvenli, anonim mesajlaşma",
    createAccount: "Hesap Oluştur",
    login: "Giriş Yap",
    username: "Kullanıcı Adı",
    password: "Şifre",
    chooseUsername: "Kullanıcı adınızı seçin",
    chooseUsernameHint: "Herhangi bir kullanıcı adı seçin (minimum 3 karakter)",
    usernameRequired: "Kullanıcı adı gerekli",
    enterUsername: "Lütfen bir kullanıcı adı girin",
    usernameTooShort: "Kullanıcı adı çok kısa",
    usernameMinLength: "Kullanıcı adı en az 3 karakter olmalı",

    loginSuccess: "Giriş başarılı",
    loginFailed: "Geçersiz kullanıcı adı veya şifre",
    passwordRequired: "Şifre gerekli",
    enterPassword: "Lütfen bir şifre girin",
    passwordTooShort: "Şifre çok kısa",
    passwordMinLength: "Şifre en az 6 karakter olmalı",
    accountCreated: "Güvenli kimliğiniz oluşturuldu",
    registrationFailed: "Kayıt başarısız",
    accountCreationFailed: "Hesap oluşturulamadı",
    noPhoneRequired: "Telefon veya e-posta gerekli değil",
    selfDestructing: "Kendini imha eden mesajlar",
    zeroDataRetention: "Sıfır veri saklama",
    chooseIdentity: "Kimliğinizi seçin",
    enterCredentials: "Mevcut kullanıcı adınızı ve şifrenizi girin",
    features: "Özellikler",

    // Chat
    searchUsers: "Kullanıcı ara...",
    searchChats: "Sohbet ara...",
    startChat: "Sohbet Başlat",
    typeMessage: "Mesaj yazın...",
    sendMessage: "Gönder",
    online: "Çevrimiçi",
    offline: "Çevrimdışı",
    connecting: "Bağlanıyor...",
    connected: "Bağlandı",
    disconnected: "Bağlantı kesildi",
    realTimeChat: "Gerçek zamanlı sohbet",
    encryptedChat: "Şifreli sohbet",
    loadingChats: "Sohbetler yükleniyor...",
    noChats: "Henüz sohbet yok",
    noChatDescription: "Şifreli sohbet başlatmak için kullanıcı arayın",
    selectChatToStart: "Güvenli mesajlaşma için bir sohbet seçin",
    welcomeToWhispergram: "Whispergram'a hoş geldiniz",

    notConnected: "Bağlı değil! Bağlantı kurulana kadar lütfen bekleyin.",
    selectChatFirst: "Dosya yüklemeden önce bir sohbet seçin ve bağlı olduğunuzdan emin olun.",
    fileTooLarge: "Dosya çok büyük! Maksimum 10MB.",
    failedToReadFile: "Görsel dosyası okunamadı",
    selectChatPhoto: "Fotoğraf çekmeden önce bir sohbet seçin ve bağlı olduğunuzdan emin olun.",

    now: "şimdi",

    // Settings
    settingsTitle: "Ayarlar",
    profile: "Profil",
    saveProfile: "Profili Kaydet",
    usernameLabel: "Kullanıcı adı",
    usernameDescription:
      'Yeni bir isim girin ve "Profili Kaydet"e tıklayın. Kullanıcı adınız anonim kimliğinizdir.',
    enterNewUsername: "Yeni kullanıcı adınızı girin",
    language: "Dil",
    about: "Hakkında",
    aboutText: "VelumChat — uçtan uca şifreli mesajlaşma.",

    profileSaved: "Profil başarıyla kaydedildi!",
    profileSaveError: "Profil kaydedilemedi. Lütfen tekrar deneyin.",
    usernameEmpty: "Kullanıcı adı boş olamaz",
    usernameExists: "Kullanıcı adı zaten alınmış",
    usernameTaken: "Kullanıcı adı zaten alınmış",
    usernameUpdated: "Kullanıcı adı başarıyla güncellendi",

    tokenMissing: "Token eksik — lütfen tekrar giriş yapın.",

    // Account deletion
    deleteAccount: "Hesabı Sil",
    deleteAccountTitle: "Hesabı Sil",
    deleteAccountDescription: "Hesabınızı ve tüm verileri kalıcı olarak silin",
    deleteAccountConfirm:
      "Hesabınızı kalıcı olarak silmek istediğinizden emin misiniz?\n\nBu işlem şunları silecek:\n- profiliniz\n- tüm sohbetler\n- tüm mesajlar\n\nKullanıcı adınız tekrar kullanılabilir olacak.",
    deleteAccountForever: "Kalıcı olarak sil",
    accountDeleted: "Hesap başarıyla silindi",
    accountDeletedDesc: "Profiliniz ve tüm içerikler silindi.",
    accountDeleteError: "Hesap silinirken hata oluştu",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationSchema, params?: Params) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function applyParams(text: string, params?: Params) {
  if (!params) return text;
  let out = text;
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("whispergram-language");
    return (saved as Language) || "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("whispergram-language", lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextType>(() => {
    const dict = base[language] || base.en;

    return {
      language,
      setLanguage,
      t: (key, params) => {
        const raw = (dict as any)[key] ?? (base.en as any)[key] ?? String(key);
        return applyParams(String(raw), params);
      },
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

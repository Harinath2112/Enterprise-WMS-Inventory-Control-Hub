export const defaultAdminProfile = {
  fullName: "IMS Admin",
  email: "admin@ims.com",
  phone: "9876543210",
  employeeId: "IMS-ADM-001",
  department: "Inventory Management",
  role: "Super Admin",
  warehouse: "Main Warehouse - Hyderabad",
  status: "Active",
  lastLogin: "Today, 10:30 AM",
};

export const defaultSettings = {
  companyName: "IMS Inventory Solutions",
  companyLogo: "",
  email: "support@ims.com",
  phone: "9876543210",
  address: "Main Branch, Hyderabad, Telangana, India",
  lowStockLimit: "10",
  defaultUnit: "pcs",
  themeMode: "light",
  language: "english",
  barcodeEnabled: true,
  autoStockUpdate: true,
  lowStockAlerts: true,
  orderNotifications: true,
  paymentReminder: false,
  collapseSidebar: false,
  twoStepVerification: false,
};

export const translations = {
  english: {
    ims: "IMS",
    admin: "Admin",
    quickActions: "+ Quick actions",
    title: "Inventory Management System",
    subtitle:
      "Click IMS Admin dropdown to test Profile, Settings and Logout actions.",
    profile: "Profile",
    settings: "Settings",
    logout: "Logout",
    livePreview: "Live Demo Preview",
    email: "Email",
    theme: "Theme",
    language: "Language",
    lightMode: "Light Mode",
    darkMode: "Dark Mode",

    settingsPage: {
      title: "Settings",
      subtitle: "Manage system preferences and configurations",
      saveChanges: "Save Changes",
      cancel: "Cancel",

      tabs: {
        general: "General Settings",
        inventory: "Inventory Settings",
        roles: "User & Role Settings",
        notifications: "Notification Settings",
        security: "Security Settings",
      },

      general: {
        title: "General Settings",
        subtitle: "Manage your company and store information",
        companyName: "Company Name",
        companyLogo: "Company Logo",
        changeLogo: "Change Logo",
        logoHint: "PNG, JPG up to 2MB",
        emailAddress: "Email Address",
        phoneNumber: "Phone Number",
        address: "Address",
      },

      inventory: {
        title: "Inventory Settings",
        subtitle: "Manage stock rules and product controls",
        lowStockLimit: "Low Stock Alert Limit",
        defaultUnit: "Default Unit Type",
        pieces: "Pieces",
        kilograms: "Kilograms",
        boxes: "Boxes",
        liters: "Liters",
        barcode: "Barcode Management",
        barcodeDesc: "Enable barcode for products",
        autoStock: "Auto Stock Update",
        autoStockDesc: "Update stock after order completion",
      },

      roles: {
        title: "User & Role Settings",
        subtitle: "Manage staff access and permissions",
        adminRole: "Admin",
        adminDesc: "Full access to IMS system",
        managerRole: "Manager",
        managerDesc: "Stock, orders and reports access",
        staffRole: "Staff",
        staffDesc: "Limited stock and order access",
        active: "Active",
        managePermissions: "Manage Permissions",
      },

      notifications: {
        title: "Notification Settings",
        subtitle: "Control IMS alerts and reminders",
        lowStockAlerts: "Low Stock Alerts",
        lowStockAlertsDesc: "Notify when product stock is low",
        orderNotifications: "Order Notifications",
        orderNotificationsDesc: "Notify on new order creation",
        supplierPayment: "Supplier Payment Reminder",
        supplierPaymentDesc: "Notify before payment due date",
      },



      security: {
        title: "Security Settings",
        subtitle: "Manage login and password security",
        changePassword: "Change Password",
        viewLoginHistory: "View Login History",
        twoStep: "Two-Step Verification",
        twoStepDesc: "Add extra security for admin login",
      },

      validation: {
        companyName: "Company name is required",
        emailRequired: "Email is required",
        emailInvalid: "Enter valid email address",
        phoneRequired: "Phone number is required",
        phoneInvalid: "Phone number must be exactly 10 digits",
        address: "Address is required",
        lowStockRequired: "Low stock limit is required",
        lowStockInvalid: "Low stock limit must be greater than 0",
        success: "Settings saved successfully",
      },
    },
  },

  telugu: {
    ims: "IMS",
    admin: "అడ్మిన్",
    quickActions: "+ త్వరిత చర్యలు",
    title: "ఇన్వెంటరీ మేనేజ్‌మెంట్ సిస్టమ్",
    subtitle:
      "ప్రొఫైల్, సెట్టింగ్స్ మరియు లాగౌట్ చర్యలను పరీక్షించడానికి IMS Admin పై క్లిక్ చేయండి.",
    profile: "ప్రొఫైల్",
    settings: "సెట్టింగ్స్",
    logout: "లాగౌట్",
    livePreview: "లైవ్ డెమో ప్రివ్యూ",
    email: "ఇమెయిల్",
    theme: "థీమ్",
    language: "భాష",
    lightMode: "లైట్ మోడ్",
    darkMode: "డార్క్ మోడ్",

    settingsPage: {
      title: "సెట్టింగ్స్",
      subtitle: "సిస్టమ్ ప్రిఫరెన్సులు మరియు కాన్ఫిగరేషన్లను నిర్వహించండి",
      saveChanges: "మార్పులు సేవ్ చేయండి",
      cancel: "రద్దు",

      tabs: {
        general: "జనరల్ సెట్టింగ్స్",
        inventory: "ఇన్వెంటరీ సెట్టింగ్స్",
        roles: "యూజర్ & రోల్ సెట్టింగ్స్",
        notifications: "నోటిఫికేషన్ సెట్టింగ్స్",
        security: "సెక్యూరిటీ సెట్టింగ్స్",
      },

      general: {
        title: "జనరల్ సెట్టింగ్స్",
        subtitle: "కంపెనీ మరియు స్టోర్ సమాచారాన్ని నిర్వహించండి",
        companyName: "కంపెనీ పేరు",
        companyLogo: "కంపెనీ లోగో",
        changeLogo: "లోగో మార్చండి",
        logoHint: "PNG, JPG 2MB వరకు",
        emailAddress: "ఇమెయిల్ అడ్రస్",
        phoneNumber: "ఫోన్ నంబర్",
        address: "అడ్రస్",
      },

      inventory: {
        title: "ఇన్వెంటరీ సెట్టింగ్స్",
        subtitle: "స్టాక్ రూల్స్ మరియు ప్రొడక్ట్ కంట్రోల్స్ నిర్వహించండి",
        lowStockLimit: "లో స్టాక్ అలర్ట్ లిమిట్",
        defaultUnit: "డిఫాల్ట్ యూనిట్ టైప్",
        pieces: "పీసెస్",
        kilograms: "కిలోగ్రాములు",
        boxes: "బాక్సులు",
        liters: "లీటర్లు",
        barcode: "బార్కోడ్ మేనేజ్‌మెంట్",
        barcodeDesc: "ప్రొడక్ట్స్ కోసం బార్కోడ్ ఎనేబుల్ చేయండి",
        autoStock: "ఆటో స్టాక్ అప్‌డేట్",
        autoStockDesc: "ఆర్డర్ పూర్తయ్యాక స్టాక్ ఆటోమేటిక్‌గా అప్‌డేట్ చేయండి",
      },

      roles: {
        title: "యూజర్ & రోల్ సెట్టింగ్స్",
        subtitle: "స్టాఫ్ యాక్సెస్ మరియు పర్మిషన్స్ నిర్వహించండి",
        adminRole: "అడ్మిన్",
        adminDesc: "IMS సిస్టమ్‌కు పూర్తి యాక్సెస్",
        managerRole: "మేనేజర్",
        managerDesc: "స్టాక్, ఆర్డర్స్ మరియు రిపోర్ట్స్ యాక్సెస్",
        staffRole: "స్టాఫ్",
        staffDesc: "లిమిటెడ్ స్టాక్ మరియు ఆర్డర్ యాక్సెస్",
        active: "యాక్టివ్",
        managePermissions: "పర్మిషన్స్ నిర్వహించండి",
      },

      notifications: {
        title: "నోటిఫికేషన్ సెట్టింగ్స్",
        subtitle: "IMS అలర్ట్స్ మరియు రిమైండర్స్ నియంత్రించండి",
        lowStockAlerts: "లో స్టాక్ అలర్ట్స్",
        lowStockAlertsDesc: "ప్రొడక్ట్ స్టాక్ తక్కువగా ఉన్నప్పుడు నోటిఫై చేయండి",
        orderNotifications: "ఆర్డర్ నోటిఫికేషన్స్",
        orderNotificationsDesc: "కొత్త ఆర్డర్ వచ్చినప్పుడు నోటిఫై చేయండి",
        supplierPayment: "సప్లయర్ పేమెంట్ రిమైండర్",
        supplierPaymentDesc: "పేమెంట్ డ్యూ డేట్ ముందు నోటిఫై చేయండి",
      },



      security: {
        title: "సెక్యూరిటీ సెట్టింగ్స్",
        subtitle: "లాగిన్ మరియు పాస్‌వర్డ్ సెక్యూరిటీ నిర్వహించండి",
        changePassword: "పాస్‌వర్డ్ మార్చండి",
        viewLoginHistory: "లాగిన్ హిస్టరీ చూడండి",
        twoStep: "టూ-స్టెప్ వెరిఫికేషన్",
        twoStepDesc: "అడ్మిన్ లాగిన్‌కు అదనపు సెక్యూరిటీ జోడించండి",
      },

      validation: {
        companyName: "కంపెనీ పేరు అవసరం",
        emailRequired: "ఇమెయిల్ అవసరం",
        emailInvalid: "సరైన ఇమెయిల్ అడ్రస్ ఇవ్వండి",
        phoneRequired: "ఫోన్ నంబర్ అవసరం",
        phoneInvalid: "ఫోన్ నంబర్ ఖచ్చితంగా 10 అంకెలు ఉండాలి",
        address: "అడ్రస్ అవసరం",
        lowStockRequired: "లో స్టాక్ లిమిట్ అవసరం",
        lowStockInvalid: "లో స్టాక్ లిమిట్ 0 కంటే ఎక్కువ ఉండాలి",
        success: "సెట్టింగ్స్ విజయవంతంగా సేవ్ అయ్యాయి",
      },
    },
  },

  hindi: {
    ims: "IMS",
    admin: "एडमिन",
    quickActions: "+ त्वरित कार्य",
    title: "इन्वेंटरी मैनेजमेंट सिस्टम",
    subtitle:
      "Profile, Settings और Logout actions test करने के लिए IMS Admin dropdown पर क्लिक करें.",
    profile: "प्रोफाइल",
    settings: "सेटिंग्स",
    logout: "लॉगआउट",
    livePreview: "लाइव डेमो प्रीव्यू",
    email: "ईमेल",
    theme: "थीम",
    language: "भाषा",
    lightMode: "लाइट मोड",
    darkMode: "डार्क मोड",

    settingsPage: {
      title: "सेटिंग्स",
      subtitle: "सिस्टम preferences और configurations manage करें",
      saveChanges: "सेव चेंजेस",
      cancel: "कैंसल",

      tabs: {
        general: "जनरल सेटिंग्स",
        inventory: "इन्वेंटरी सेटिंग्स",
        roles: "यूज़र & रोल सेटिंग्स",
        notifications: "नोटिफिकेशन सेटिंग्स",
        security: "सिक्योरिटी सेटिंग्स",
      },

      general: {
        title: "जनरल सेटिंग्स",
        subtitle: "कंपनी और स्टोर information manage करें",
        companyName: "कंपनी नाम",
        companyLogo: "कंपनी लोगो",
        changeLogo: "लोगो बदलें",
        logoHint: "PNG, JPG up to 2MB",
        emailAddress: "ईमेल एड्रेस",
        phoneNumber: "फोन नंबर",
        address: "एड्रेस",
      },

      inventory: {
        title: "इन्वेंटरी सेटिंग्स",
        subtitle: "Stock rules और product controls manage करें",
        lowStockLimit: "लो स्टॉक अलर्ट लिमिट",
        defaultUnit: "डिफॉल्ट यूनिट टाइप",
        pieces: "पीसेस",
        kilograms: "किलोग्राम",
        boxes: "बॉक्सेस",
        liters: "लीटर्स",
        barcode: "बारकोड मैनेजमेंट",
        barcodeDesc: "Products के लिए barcode enable करें",
        autoStock: "ऑटो स्टॉक अपडेट",
        autoStockDesc: "Order complete होने के बाद stock auto update करें",
      },

      roles: {
        title: "यूज़र & रोल सेटिंग्स",
        subtitle: "Staff access और permissions manage करें",
        adminRole: "एडमिन",
        adminDesc: "IMS system का full access",
        managerRole: "मैनेजर",
        managerDesc: "Stock, orders और reports access",
        staffRole: "स्टाफ",
        staffDesc: "Limited stock और order access",
        active: "एक्टिव",
        managePermissions: "Manage Permissions",
      },

      notifications: {
        title: "नोटिफिकेशन सेटिंग्स",
        subtitle: "IMS alerts और reminders control करें",
        lowStockAlerts: "लो स्टॉक अलर्ट्स",
        lowStockAlertsDesc: "Product stock low होने पर notify करें",
        orderNotifications: "ऑर्डर नोटिफिकेशन्स",
        orderNotificationsDesc: "New order create होने पर notify करें",
        supplierPayment: "Supplier Payment Reminder",
        supplierPaymentDesc: "Payment due date से पहले notify करें",
      },



      security: {
        title: "सिक्योरिटी सेटिंग्स",
        subtitle: "Login और password security manage करें",
        changePassword: "Change Password",
        viewLoginHistory: "View Login History",
        twoStep: "Two-Step Verification",
        twoStepDesc: "Admin login के लिए extra security add करें",
      },

      validation: {
        companyName: "Company name required है",
        emailRequired: "Email required है",
        emailInvalid: "Valid email address enter करें",
        phoneRequired: "Phone number required है",
        phoneInvalid: "Phone number exactly 10 digits होना चाहिए",
        address: "Address required है",
        lowStockRequired: "Low stock limit required है",
        lowStockInvalid: "Low stock limit 0 से ज्यादा होना चाहिए",
        success: "Settings successfully saved",
      },
    },
  },
};

export const getTranslatedText = (language) => {
  return translations[language] || translations.english;
};
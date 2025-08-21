# Sybilla Sedlar Website - Content Management System

Ein sicheres Content Management System für die Website von Sybilla Sedlar mit automatischem Deployment.

## 🚀 Features

- **Sichere Authentifizierung**: Session-basierte Anmeldung mit Rate Limiting
- **Content Management**: Bearbeitung aller Website-Inhalte über eine benutzerfreundliche Oberfläche
- **Bild-Upload**: Sichere Bildverwaltung für Hero-Image und Profilbild
- **Auto-Deployment**: Automatisches Git Commit und Deployment bei Veröffentlichung
- **Live-Vorschau**: Sofortige Aktualisierung der Website nach Änderungen
- **Content-Sanitization**: Schutz vor XSS und Code-Injection
- **Backup-System**: Automatische Backups bei jeder Änderung

## 🔧 Installation

### Voraussetzungen
- Node.js >= 14.0.0
- Git Repository (für Auto-Deployment)
- Optional: Vercel CLI für direktes Deployment

### Setup

1. **Dependencies installieren:**
```bash
npm install
```

2. **Server starten:**
```bash
# Entwicklung (ohne Git Deployment)
npm start

# Produktion (mit Git Deployment)
npm run deploy
```

3. **Admin Panel aufrufen:**
```
http://localhost:3000/admin.html
```

## 🔐 Sicherheit

### Anmeldedaten
- **Benutzername**: `sybilla`
- **Passwort**: `secret`

⚠️ **WICHTIG**: Ändern Sie diese Credentials in der Produktion!

### Sicherheitsfeatures
- Session-basierte Authentifizierung (2h Gültigkeit)
- Rate Limiting (10 Requests/15min)
- Content Sanitization (XSS-Schutz)
- File Upload Validation
- Token-basierte API-Authentifizierung

## 📁 Dateistruktur

```
sybilla-website/
├── index.html              # Hauptwebsite
├── admin.html              # Admin Interface
├── admin.js                # Admin Panel Logic
├── content-loader.js       # Dynamic Content Loading
├── content.json            # Website Content (editierbar)
├── server.js               # Node.js Server
├── deploy.sh               # Deployment Script
├── package.json            # Node.js Dependencies
└── README-CMS.md           # Diese Dokumentation
```

## 🎛️ Admin Panel Funktionen

### 1. Hero Bereich
- Haupttitel bearbeiten
- Untertitel anpassen
- Button-Text ändern
- Hintergrundbild austauschen

### 2. Über mich
- Name und Titel bearbeiten
- Beschreibungstexte anpassen
- Profilbild austauschen

### 3. Leistungen
- Service-Titel und Beschreibungen bearbeiten
- Neue Services hinzufügen/entfernen

### 4. Kundenstimmen
- Testimonials bearbeiten
- Autoren und Positionen anpassen

### 5. Kontakt
- Kontaktformular ein-/ausschalten
- Beschreibungstext anpassen

### 6. Bilder
- Hero-Hintergrundbild hochladen
- Profilbild verwalten
- Automatische Größenanpassung

## 🌐 Deployment

### Automatisches Deployment

1. **Änderungen speichern** (lokale Speicherung)
2. **Veröffentlichen** (Git Commit + Push + Deployment)

### Deployment-Prozess

```bash
# Automatisch bei "Veröffentlichen":
git add .
git commit -m "Update content via admin panel"
git push origin main

# Optional: Vercel Deployment
vercel --prod
```

### Umgebungsvariablen

```bash
# .env Datei erstellen:
PORT=3000
SECRET_KEY=your-secure-secret-key
GIT_ENABLED=true
```

## 🔄 Content Loading

Die Website lädt Inhalte dynamisch aus `content.json`:

1. **Beim Seitenaufruf**: Automatisches Laden der aktuellen Inhalte
2. **Nach Admin-Änderungen**: Sofortige Aktualisierung ohne Neuladen
3. **Fallback**: Static HTML falls JSON nicht verfügbar

## 🛡️ Sicherheitsempfehlungen

### Für die Produktion:

1. **Credentials ändern:**
```javascript
// In server.js und admin.js anpassen:
username !== 'IHR_SICHERER_USERNAME'
password !== 'IHR_SICHERES_PASSWORT'
```

2. **HTTPS verwenden:**
- SSL-Zertifikat einrichten
- Secure Cookies aktivieren

3. **Firewall einrichten:**
- Admin-Routes nur für bestimmte IPs
- VPN-Zugang für Admin Panel

4. **Backup-Strategie:**
- Regelmäßige Backups der content.json
- Git-History als zusätzliche Sicherung

## 🐛 Troubleshooting

### Häufige Probleme:

1. **Login funktioniert nicht**
   - Server läuft? `npm start`
   - Credentials korrekt?
   - Browser-Cache leeren

2. **Bilder werden nicht gespeichert**
   - Dateigröße < 10MB?
   - Gültiges Bildformat (PNG/JPG)?
   - Schreibrechte im Verzeichnis?

3. **Deployment schlägt fehl**
   - Git Repository eingerichtet?
   - `GIT_ENABLED=true` gesetzt?
   - Remote Repository verfügbar?

### Log-Ausgaben:

```bash
# Server-Logs anzeigen:
tail -f server.log

# Git-Status prüfen:
git status
git log --oneline
```

## 📞 Support

Bei Problemen oder Fragen:

1. **Logs prüfen**: Browser-Konsole und Server-Logs
2. **Backup wiederherstellen**: Aus `content-backup-*.json`
3. **Git-History**: `git log` für frühere Versionen

## 🔄 Updates

Regelmäßige Updates für:
- Security Patches
- Feature-Erweiterungen
- Performance-Optimierungen

```bash
# Dependencies aktualisieren:
npm update

# CMS-System aktualisieren:
git pull origin main
npm install
```

---

**Entwickelt für Sybilla Sedlar** | Sicher, Benutzerfreundlich, Automatisiert
# Aplicația Joc Battleship

O implementare completă a jocului Battleship (Bătălia Navală) care include o aplicație mobilă React Native și trei microservicii backend pentru autentificare, gestionarea jocului și împerecherea jucătorilor.

## Prezentare Generală a Arhitecturii

Aplicația constă din:

- **Aplicația Mobilă** (`PhoneApp/BattleShip/`): Aplicație React Native Expo pentru joc
- **AuthService** (`Servicii/AuthService/`): Autentificare utilizatori și gestionarea token-urilor JWT
- **GameService** (`Servicii/GameService/`): Gestionarea stării jocului, validarea tablelor și joc în timp real via WebSocket
- **QueueService** (`Servicii/QueueService/`): Împerecherea jucătorilor și crearea jocurilor

## Services
- **AuthService:** https://github.com/MegasusBMS/AuthService-BattleShip
- **GameService:** https://github.com/MegasusBMS/GameService-BattleShip
- **QueueService:** https://github.com/MegasusBMS/QueueService-BattleShip

## Funcționalități

### Aplicația Mobilă
- Înregistrare și autentificare utilizatori
- Joc multiplayer în timp real
- Plasarea navelor prin drag-and-drop
- Tablă de joc vizuală cu indicatori pentru lovituri/ratări
- Integrare WebSocket pentru actualizări live
- Sistem de coadă pentru jucători
- Istoric jocuri și statistici

### Servicii Backend
- **Autentificare**: Gestionarea utilizatorilor bazată pe JWT
- **Logică Joc**: Implementare completă a regulilor Battleship
- **Comunicare în Timp Real**: Suport WebSocket pentru joc live
- **Împerechere**: Împerechere automată a jucătorilor

## Tehnologii Utilizate

### Aplicația Mobilă
- React Native
- Expo Router
- TypeScript
- AsyncStorage pentru gestionarea token-urilor
- WebSocket pentru actualizări în timp real

### Servicii Backend
- Node.js
- Express.js
- WebSocket (biblioteca ws)
- JWT pentru autentificare
- Stocare în memorie (dezvoltare)

## Reguli Joc

- Câmp de luptă 10x10
- Nave: 2x1, 2x2, 3x1, 4x1 și 3x2 (în formă de U)
- Jucătorii trag alternativ în grila adversarului
- Lovește toate părțile unei nave pentru a o scufunda
- Primul care scufundă toate navele inamice câștigă

## Instalare și Configurare

### Cerințe Preliminare
- Node.js (v16+)
- npm sau yarn
- Expo CLI (pentru aplicația mobilă)

### 1. Clonare și Configurare Servicii

```bash
# Navighează la directorul servicii
cd Servicii

# Configurare AuthService
cd AuthService
npm install
npm run start  # Rulează pe portul 3001

# Configurare GameService (terminal nou)
cd ../GameService
npm install
npm run start  # Rulează pe portul 3002

# Configurare QueueService (terminal nou)
cd ../QueueService
npm install
npm run start  # Rulează pe portul 3003
```

### 2. Configurare Aplicație Mobilă

```bash
# Navighează la aplicația mobilă
cd ../../PhoneApp/BattleShip

# Instalează dependențele
npm install

# Configurează endpoint-urile API (opțional)
# Actualizează services/auth.ts, services/gameApi.ts, services/queue.ts cu URL-urile corecte

# Pornește aplicația
npm start
```

### 3. Variabile de Mediu

Creează fișiere `.env` în fiecare director de serviciu dacă este necesar:

**AuthService:**
```
PORT=3001
JWT_SECRET=cheia-ta-secreta
JWT_TTL=1h
```

**GameService:**
```
PORT=3002
```

**QueueService:**
```
PORT=3003
GAME_SERVICE_URL=http://localhost:3002
AUTH_SERVICE_URL=http://localhost:3001
```

## Documentație API

### AuthService (Port 3001)

#### POST `/auth/signup`
Înregistrează un utilizator nou.

**Cerere:**
```json
{
  "email": "string",
  "username": "string",
  "password": "string"
}
```

**Răspuns:**
```json
{
  "token": "jwt-token",
  "user": {
    "uuid": "user-uuid",
    "username": "username"
  }
}
```

#### POST `/auth/login`
Autentifică utilizatorul.

**Cerere:**
```json
{
  "username": "string",
  "password": "string"
}
```

#### POST `/auth/introspect`
Validează token-ul JWT.

**Cerere:**
```json
{
  "token": "jwt-token"
}
```

### GameService (Port 3002)

#### POST `/create-game`
Creează o nouă sesiune de joc.

#### POST `/submit-board`
Trimite configurația tablei jucătorului.

#### POST `/fire`
Execută un atac pe tabla adversarului.

#### GET `/state`
Obține starea curentă a jocului (debugging).

**Evenimente WebSocket:**
- `connected`: Jucător conectat la joc
- `attack_received`: Notificare atac
- `board_submitted`: Notificare trimitere tablă
- `game_started`: Inițializare joc
- `game_ended`: Finalizare joc

### QueueService (Port 3003)

**Conexiune WebSocket:** `ws://localhost:3003/queue`

**Evenimente:**
- `matched`: Jucător împerecheat cu adversar
- `error`: Notificare eroare

## Rularea Aplicației

1. Pornește toate cele trei servicii în terminale separate
2. Pornește aplicația Expo mobilă
3. Înregistrează/autentifică utilizatori pe dispozitive/simulatoare diferite
4. Alătură-te cozii pentru a găsi adversari
5. Plasează navele și începe bătălia!

## Dezvoltare

### Structura Proiectului

```
/
├── PhoneApp/BattleShip/          # Aplicație React Native Expo
│   ├── app/                       # Ecrane aplicație (rutare bazată pe fișiere)
│   ├── components/                # Componente UI reutilizabile
│   ├── services/                  # Clienți servicii API
│   └── utils/                     # Utilitare (stocare token-uri, etc.)
└── Servicii/                      # Servicii Backend
    ├── AuthService/               # Serviciu autentificare
    ├── GameService/               # Serviciu logică joc
    └── QueueService/              # Serviciu împerechere
```

### Adăugarea Funcționalităților Noi

- **Aplicație Mobilă**: Adaugă ecrane noi în directorul `app/`
- **Servicii**: Urmează pattern-urile existente pentru endpoint-uri noi
- **WebSocket**: Folosește structura de evenimente stabilită

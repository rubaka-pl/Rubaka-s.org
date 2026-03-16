# Rubaka's.org

Rubaka's.org is a browser-based gaming platform built with Vite, TypeScript, and Supabase.  
The site allows users to launch HTML5/browser games directly in an iframe, track play sessions, earn XP, maintain a daily streak, and view profile statistics.

## Features

- Browser game catalog
- Game launch via iframe
- User authentication with Supabase Auth
- Profile page with nickname, avatar, XP, level, and streak
- Recent Activity tracking
- Most Played Games statistics
- Daily streak system with bonus XP
- Real-time game session tracking
- XP progression system

## Tech Stack

### Frontend
- Vite
- TypeScript
- Vanilla JavaScript
- HTML
- CSS

### Backend / Services
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security (RLS)

## Main Functionality

### Authentication
Users can:
- sign up with email and password
- sign in with email and password
- sign in with Google OAuth
- sign out

### Game Sessions
When a game is opened:
- a new session is created
- progress is tracked over time
- session duration is stored in the database
- recent activity is updated

### XP and Levels
Players earn XP based on playtime.  
The profile page calculates the current level and progress to the next one.

### Daily Streak
Users can maintain a login streak and receive daily bonus XP.  
A daily check-in system is also available from the profile page.

### Profile Page
The profile page displays:
- avatar
- nickname
- email
- joined date
- level
- total XP
- time played
- games played
- current streak
- longest streak
- recent activity
- most played games

## Project Structure

```text
src/
 ├─ ts/
 │   ├─ main.ts
 │   ├─ profile.ts
 │   ├─ userProgress.ts
 │   ├─ headerAuth.ts
 │   ├─ filters.ts
 │   ├─ games.ts
 │   ├─ supabase.ts
 │   ├─ types.ts
 │
 ├─ styles/
 │   ├─ main.css
 │   ├─ profile.css
 │   ├─ auth.css
 │
pages/
 ├─ login.html
 ├─ profile.html

index.html


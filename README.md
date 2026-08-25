# GEM Kompas

Responsywna aplikacja do comiesięcznego sprawdzania adaptowanego sygnału Global Equity Momentum dla ETF-ów EIMI, IWDA, CNDX, CBU0 i IB01 notowanych na LSE w USD.

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja będzie dostępna pod adresem `http://127.0.0.1:5173`.

## Reguła

Raz w miesiącu aplikacja:

1. porównuje 12-miesięczne momentum EIMI, IWDA i CNDX,
2. sprawdza, czy zwycięzca części akcyjnej pokonuje IB01,
3. przy sygnale risk-on wskazuje zwycięzcę akcyjnego, a przy risk-off wybiera silniejszy z CBU0 i IB01.

Jeżeli w aplikacji ustawiono obecną pozycję, zmiana następuje dopiero wtedy, gdy nowy kandydat ma momentum wyższe o co najmniej 3 punkty procentowe. Bufor ogranicza zbędne transakcje przy niewielkich różnicach między aktywami.

Sygnał jest zamrażany na podstawie ostatniej sesji zakończonego miesiąca. To adaptacja mechaniki dual momentum do aktywów ze screena, a nie dokładna implementacja klasycznego GEM Gary'ego Antonacciego, który wykorzystuje akcje USA, akcje poza USA i szeroki indeks obligacji agregatowych.

Notowania pobierane są serwerowo z publicznego endpointu Yahoo Finance i buforowane przez 15 minut. Przed transakcją należy potwierdzić dane oraz ticker u brokera.

## Wdrożenie na Vercel

Projekt zawiera gotową konfigurację Vercela: frontend jest budowany przez Vite do katalogu `dist`, a endpoint `/api/market` działa jako Vercel Function.

1. Umieść projekt w repozytorium GitHub, GitLab albo Bitbucket.
2. W Vercelu wybierz **Add New → Project** i zaimportuj repozytorium.
3. Pozostaw wykryty preset **Vite** i kliknij **Deploy**. Projekt nie wymaga zmiennych środowiskowych.

Przed wysłaniem zmian możesz sprawdzić projekt lokalnie:

```bash
npm ci
npm test
npm run lint
npm run build
```

Alternatywnie, po zalogowaniu w Vercel CLI, uruchom `vercel` w katalogu projektu.

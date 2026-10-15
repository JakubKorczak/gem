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

1. porównuje stopę zwrotu z ostatnich 12 miesięcy dla EIMI, IWDA i CNDX,
2. sprawdza, czy zwycięzca części akcyjnej pokonuje IB01,
3. przy sygnale risk-on wskazuje zwycięzcę akcyjnego, a przy risk-off wybiera silniejszy z CBU0 i IB01.

Jeżeli w aplikacji ustawiono obecną pozycję, zmiana następuje dopiero wtedy, gdy nowy kandydat ma stopę zwrotu wyższą o co najmniej 3 punkty procentowe. Bufor ogranicza zbędne transakcje przy niewielkich różnicach między aktywami. Nie dotyczy to obowiązkowego wyjścia z ETF-u akcyjnego po pojawieniu się trybu ochronnego: wtedy aplikacja zawsze wybiera silniejszy z CBU0 i IB01.

Sygnał jest wyliczany wyłącznie dla dokładnie oczekiwanej ostatniej sesji LSE zakończonego miesiąca oraz analogicznej sesji rok wcześniej. Wszystkie aktywa muszą mieć notowania z obu tych dat, w USD i na LSE. Brak lub niespójność choćby jednego notowania zatrzymuje publikację sygnału zamiast przesuwać cały okres wstecz. Rok bez zweryfikowanego kalendarza LSE również nie generuje aktywnej decyzji.

Notowania pobierane są serwerowo z publicznego endpointu Yahoo Finance i buforowane przez 15 minut dopiero po przejściu kompletnej walidacji. Przed transakcją należy potwierdzić dane oraz ticker u brokera.

## Bieżące ceny ETF-ów

Pod głównym sygnałem sekcja **Co słychać na rynkach?** pokazuje pięć małych kart: cenę ETF-u w USD, zmianę kwotową i procentową względem poprzedniego zamknięcia oraz czas notowania w strefie Europe/Warsaw. Dane nie zmieniają miesięcznego sygnału strategii.

Endpoint `/api/quotes` korzysta z publicznego API Yahoo Finance (`/v8/finance/chart`, `range=1d`, `interval=5m`), bez klucza API. Weryfikuje ticker, LSE, USD, dodatnie ceny i czas notowania. Ceną jest `regularMarketPrice`, a bazą zmiany `previousClose`, nie skorygowana cena historyczna ani początek zakresu wykresu. Udane odpowiedzi dla każdego instrumentu są buforowane na serwerze przez minutę; błąd jednego ETF-u nie blokuje pozostałych ani miesięcznego sygnału. Publiczne źródło może ograniczać zapytania lub być niedostępne.

Karty odświeżają się co minutę i po powrocie do okna. Sesja jest rozpoznawana na podstawie godzin zwróconych przez dostawcę. Poza sesją karty mają przygaszone tło i opis „ostatnia cena”; starsze dane i tryb offline mają bursztynowe tło oraz jawny status. Notowanie starsze niż 30 minut podczas sesji, brak ostatniej oczekiwanej sesji, błąd odświeżenia lub odpowiedź sprzed ponad 5 minut nie są oznaczane jako bieżące. Zawsze widoczna jest faktyczna data ceny; ceny mogą być opóźnione. Bieżące notowania nie są zapisywane przez service workera i nie korzystają ze snapshotu miesięcznego sygnału.

W aplikacji znajduje się domyślnie zamknięta sekcja **Jak działa GEM Kompas?**. W dziewięciu krótkich częściach wyjaśnia cały przepływ: dane, sposób wyboru aktywa, bufor, obecną pozycję, termin decyzji, statusy danych, tryb offline i ograniczenia strategii.

## Przypomnienie i instalacja na telefonie

- GEM Kompas można zainstalować jako PWA z menu przeglądarki lub przyciskiem instalacyjnym, jeżeli przeglądarka go udostępnia. Na iPhonie użyj **Udostępnij → Do ekranu głównego**.
- Po co najmniej jednym poprawnym pobraniu danych aplikacja zapisuje zweryfikowany, wersjonowany snapshot ostatniego sygnału. Dane są oznaczane jako aktualne online, aktualne z pamięci albo stare. Snapshot z wcześniejszego miesiąca pozostaje dostępny wyłącznie informacyjnie i nie pokazuje instrukcji kupna ani sprzedaży.
- Jeżeli planowany dzień decyzji już minął, aplikacja nie blokuje użytkownika komunikatem „nie składaj zlecenia”, tylko wyjaśnia, że zamknięty sygnał nadal obowiązuje do kolejnego terminu i przypomina o potwierdzeniu cen u brokera.

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
git diff --check
```

Po zalogowaniu w Vercel CLI można dodatkowo odtworzyć produkcyjny build poleceniem `vercel build --prod`.

## Raport walidacji strategii

Czysty silnik backtestu wyznacza sygnał na zamknięciu miesiąca i wykonuje go dopiero po cenie zamknięcia następnej wspólnej sesji, aby nie przypisywać nowej pozycji ruchu sprzed możliwego zlecenia. Historyczne month-endy pochodzą z serii referencyjnej `^FTSE` dla LSE i `SPY` dla rynku USA. Brak notowania któregokolwiek aktywa w oczekiwanym month-end przerywa raport zamiast przesuwać okres wstecz. Raport porównuje progi 0/1/2/3/5 p.p., koszty 0/10/25 punktów bazowych, wariant UCITS z CNDX i bez CNDX, rozszerzone proxy EEM/URTH/QQQ/IEF/BIL oraz klasyczny punkt odniesienia SPY/VEU/AGG. Podaje między innymi CAGR, zmienność, dzienne i miesięczne obsunięcia, obrót, czas w aktywach, liczbę zmian i potencjalnych zdarzeń podatkowych. Nie zakłada jednej stawki podatku i nie zmienia automatycznie ustawień aplikacji.

```bash
npm run backtest
npm run backtest:json
```

Yahoo musi jawnie zwrócić skorygowane dane dzienne. Generator przerywa raport, jeżeli dostawca zwróci inną częstotliwość lub zbyt krótką serię. Wyniki można zapisać do pliku przez standardowe przekierowanie wyjścia, na przykład `npm run backtest > raport.md`.

export const APP_GUIDE_SECTIONS = [
  {
    title: 'Co robi aplikacja?',
    body: 'Raz w miesiącu porównuje pięć ETF-ów i wskazuje jedno aktywo. Nie śledzi rynku w ciągu dnia i nie próbuje przewidywać jutrzejszych cen.',
  },
  {
    title: 'Skąd są dane?',
    body: 'Aplikacja pobiera z Yahoo Finance skorygowane ceny zamknięcia z giełdy w Londynie. Sygnał wykorzystuje wyłącznie ostatni zakończony miesiąc i ten sam okres dla wszystkich ETF-ów.',
  },
  {
    title: 'Jak powstaje sygnał?',
    body: 'Najpierw wybierany jest najlepszy z EIMI, IWDA i CNDX według stopy zwrotu z ostatnich 12 miesięcy. Potem wynik jest porównywany z IB01. Jeśli akcje są słabsze, aplikacja przechodzi w tryb ochronny i wybiera lepszy z CBU0 i IB01.',
  },
  {
    title: 'Co oznacza bufor 3 p.p.?',
    body: 'Mała przewaga nowego aktywa nie musi oznaczać zmiany. Nowy kandydat powinien prowadzić o co najmniej 3 punkty procentowe. Bufor ogranicza drobne rotacje, ale nigdy nie blokuje wyjścia z akcji do trybu ochronnego.',
  },
  {
    title: 'Po co ustawiać obecną pozycję?',
    body: 'Dzięki temu aplikacja może powiedzieć „utrzymuj” albo „zamień”. Wybór zapisuje się tylko na tym urządzeniu. Aplikacja nie łączy się z rachunkiem maklerskim i nie zna liczby posiadanych jednostek.',
  },
  {
    title: 'Kiedy wykonać decyzję?',
    body: 'Sprawdź aplikację w pierwszym dniu sesyjnym miesiąca. Przed zleceniem potwierdź u brokera ticker, walutę, cenę i to, czy dane w aplikacji są aktualne.',
  },
  {
    title: 'Co oznaczają statusy danych?',
    body: 'Sygnał online pochodzi z bieżącego odczytu. Aktualny zapisany sygnał można wykorzystać bez sieci w tym samym miesiącu. Stary zapis służy tylko do informacji i nie pokazuje instrukcji transakcyjnej.',
  },
  {
    title: 'Jak działa offline i kalendarz?',
    body: 'Po poprawnym pobraniu aplikacja zapisuje ostatni zweryfikowany sygnał. Kalendarz przypomina o pierwszym dniu sesyjnym, ale daty po ostatnim oficjalnie sprawdzonym roku wymagają aktualizacji kalendarza LSE.',
  },
  {
    title: 'Ważne ograniczenie',
    body: 'To adaptacja strategii GEM, a nie prognoza ani gwarancja wyniku. Koszyki różnią się od klasycznego GEM. Aplikacja nie składa zleceń i nie zastępuje samodzielnej oceny ryzyka.',
  },
] as const

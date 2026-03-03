# Fråvarosystem / Absence System

Deltagare kan markera sig som frånvarande och begära återkomst. Systemet loggar alla fråvaroperioder för röstlängd och protokoll. Återkomst kräver admin-godkännande.

## Deltagare

- **Markera frånvaro** – Registrera att du lämnar mötet. Du tas bort från talarkön om du står i den. Du kan inte rösta i omröstningar medan du är frånvarande.
- **Återkom till mötet** – Skicka en återkomstanmälan. Admin måste godkänna innan du räknas som närvarande igen.
- **Återkalla återkomstanmälan** – Avbryt din begäran om återkomst.

Du kan inte markera frånvaro om du håller på att tala (talarkö, punkt, replik).

## Admin

- **Frånvarande** – Lista över deltagare som för närvarande är frånvarande (namn, hur länge).
- **Fråvarohistorik** – Logg över alla fråvaroperioder (namn, starttid, sluttid) för protokoll och röstlängd.
- **Återkomstanmälan** – Godkänn eller avslå begäran om återkomst. Vid godkännande stängs den öppna fråvaroperioden med sluttid, deltagarens `absentSince` nollställs och mötets räknare uppdateras.

## Datamodell

### meetingParticipants.absentSince

- `0` – deltagaren är närvarande.
- `> 0` – epoch-ms när deltagaren markerade frånvaro; deltagaren räknas som frånvarande tills admin godkänner återkomst (då sätts `absentSince` till 0).

### absenceEntries (tabell)

En rad per fråvaroperiod:

| Fält      | Beskrivning                                                                   |
| --------- | ----------------------------------------------------------------------------- |
| meetingId | Möte                                                                          |
| userId    | Deltagare                                                                     |
| name      | Namn vid frånvarotillfället                                                   |
| startTime | När frånvaron började (epoch ms)                                              |
| endTime   | När perioden avslutades (admin godkände återkomst). Saknas = pågående period. |

Index: `by_meeting`, `by_meeting_user`, `by_meeting_startTime`.

### returnRequests (tabell)

Återkomstanmälan innan admin godkänner/avslår:

| Fält        | Beskrivning                      |
| ----------- | -------------------------------- |
| meetingId   | Möte                             |
| userId      | Deltagare                        |
| name        | Namn                             |
| requestedAt | När begäran skickades (epoch ms) |

Index: `by_meeting`, `by_meeting_user`.

### meeting.participants / meeting.absent

Räknare på mötet:

- **participants** – antal deltagare på röstlängden (ökas endast när någon ansluter till mötet).
- **absent** – antal frånvarande (ökas vid frånvaroregistrering, minskas vid godkänd återkomst).

Röstlängd = participants. Närvarande = participants − absent.

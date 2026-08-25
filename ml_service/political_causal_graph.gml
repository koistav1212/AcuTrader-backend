graph [
  directed 1
  node [
    id 0
    label "Delhi"
    type "GPE"
  ]
  node [
    id 1
    label "Bharatiya Janata Party"
    type "ORG"
  ]
  node [
    id 2
    label "Raghav Chadha"
    type "PERSON"
  ]
  node [
    id 3
    label "Aam Aadmi Party"
    type "ORG"
  ]
  node [
    id 4
    label "Lok Sabha"
    type "PERSON"
  ]
  node [
    id 5
    label "Event_1: GENERAL"
    type "event"
    date "2019-05-01"
    source "Economic Times"
    event_type "general"
    priority "LOW"
    is_core 0
  ]
  node [
    id 6
    label "Arvind Kejriwal"
    type "PERSON"
  ]
  node [
    id 7
    label "Centre"
    type "ORG"
  ]
  node [
    id 8
    label "Parliament"
    type "ORG"
  ]
  node [
    id 9
    label "Event_2: GENERAL"
    type "event"
    date "2023-07-31"
    source "NDTV"
    event_type "general"
    priority "LOW"
    is_core 0
  ]
  node [
    id 10
    label "Event_3: CONFLICT"
    type "event"
    date "2023-11-20"
    source "NDTV"
    event_type "conflict"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 11
    label "Enforcement Directorate"
    type "ORG"
  ]
  node [
    id 12
    label "Event_4: GENERAL"
    type "event"
    date "2024-03-21"
    source "NDTV"
    event_type "general"
    priority "LOW"
    is_core 0
  ]
  node [
    id 13
    label "Event_5: GENERAL"
    type "event"
    date "2024-01-16"
    source "NDTV"
    event_type "general"
    priority "LOW"
    is_core 0
  ]
  node [
    id 14
    label "Event_6: GENERAL"
    type "event"
    date "2026-04-10"
    source "Economic Times"
    event_type "general"
    priority "MEDIUM"
    is_core 0
  ]
  node [
    id 15
    label "Event_7: CONFLICT"
    type "event"
    date "2026-04-03"
    source "Economic Times"
    event_type "conflict"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 16
    label "The Rajya Sabha"
    type "ORG"
  ]
  node [
    id 17
    label "Event_8: REMOVAL"
    type "event"
    date "2026-04-02"
    source "NDTV"
    event_type "removal"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 18
    label "Event_9: CONFLICT"
    type "event"
    date "2026-04-03"
    source "NDTV"
    event_type "conflict"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 19
    label "Event_10: GENERAL"
    type "event"
    date "2026-04-05"
    source "NDTV"
    event_type "general"
    priority "MEDIUM"
    is_core 0
  ]
  node [
    id 20
    label "Event_11: CONFLICT"
    type "event"
    date "2026-04-15"
    source "Times of India"
    event_type "conflict"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 21
    label "Rajya Sabha Mps"
    type "ORG"
  ]
  node [
    id 22
    label "Event_12: RESIGNATION"
    type "event"
    date "2026-04-24"
    source "Economic Times"
    event_type "resignation"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 23
    label "Event_13: RESIGNATION"
    type "event"
    date "2026-04-24"
    source "Economic Times"
    event_type "resignation"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 24
    label "Narendra Modi"
    type "PERSON"
  ]
  node [
    id 25
    label "Event_14: GENERAL"
    type "event"
    date "2026-04-24"
    source "Navbharat Times"
    event_type "general"
    priority "LOW"
    is_core 0
  ]
  node [
    id 26
    label "Event_15: CONFLICT"
    type "event"
    date "2026-04-25"
    source "Times of India"
    event_type "conflict"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 27
    label "Event_16: PROTEST"
    type "event"
    date "2026-04-25"
    source "NDTV"
    event_type "protest"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 28
    label "Event_17: PROTEST"
    type "event"
    date "2026-04-26"
    source "Times of India"
    event_type "protest"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 29
    label "Rajya Sabha"
    type "ORG"
  ]
  node [
    id 30
    label "Event_18: GENERAL"
    type "event"
    date "2026-04-27"
    source "Times of India"
    event_type "general"
    priority "LOW"
    is_core 0
  ]
  node [
    id 31
    label "Anna Hazare"
    type "PERSON"
  ]
  node [
    id 32
    label "Event_19: GENERAL"
    type "event"
    date "2026-04-27"
    source "Times of India"
    event_type "general"
    priority "LOW"
    is_core 0
  ]
  node [
    id 33
    label "Event_20: PROTEST"
    type "event"
    date "2026-04-26"
    source "Times of India"
    event_type "protest"
    priority "HIGH"
    is_core 1
  ]
  node [
    id 34
    label "Event_21: JOINING"
    type "event"
    date "2026-04-25"
    source "Times of India"
    event_type "joining"
    priority "HIGH"
    is_core 1
  ]
  edge [
    source 0
    target 5
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 0
    target 1
    relation "co_occurs"
    weight 0.1
    date "2019-05-01"
    color "lightgray"
  ]
  edge [
    source 0
    target 2
    relation "co_occurs"
    weight 0.1
    date "2019-05-01"
    color "lightgray"
  ]
  edge [
    source 0
    target 3
    relation "co_occurs"
    weight 0.1
    date "2019-05-01"
    color "lightgray"
  ]
  edge [
    source 0
    target 9
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 1
    target 5
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 1
    target 2
    relation "co_occurs"
    weight 0.1
    date "2019-05-01"
    color "lightgray"
  ]
  edge [
    source 1
    target 3
    relation "co_occurs"
    weight 0.1
    date "2019-05-01"
    color "lightgray"
  ]
  edge [
    source 1
    target 4
    relation "co_occurs"
    weight 0.1
    date "2019-05-01"
    color "lightgray"
  ]
  edge [
    source 1
    target 10
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 1
    target 13
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 1
    target 23
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 1
    target 16
    relation "co_occurs"
    weight 0.1
    date "2026-04-24"
    color "lightgray"
  ]
  edge [
    source 1
    target 28
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 1
    target 34
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 5
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 3
    relation "RESIGN"
    weight 0.1779
    date "2026-04-24"
    color "green"
  ]
  edge [
    source 2
    target 4
    relation "co_occurs"
    weight 0.1
    date "2019-05-01"
    color "lightgray"
  ]
  edge [
    source 2
    target 9
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 10
    relation "DEFEND"
    color "#2c3e50"
  ]
  edge [
    source 2
    target 6
    relation "DEFEND"
    weight -0.6124
    date "2023-11-20"
    color "red"
  ]
  edge [
    source 2
    target 12
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 13
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 14
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 15
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 17
    relation "REMOVE"
    color "#2c3e50"
  ]
  edge [
    source 2
    target 16
    relation "REMOVE"
    weight 0.0
    date "2026-04-02"
    color "gray"
  ]
  edge [
    source 2
    target 18
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 19
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 20
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 22
    relation "RESIGN"
    color "#2c3e50"
  ]
  edge [
    source 2
    target 23
    relation "JOIN"
    color "#2c3e50"
  ]
  edge [
    source 2
    target 1
    relation "JOIN"
    weight 0.6124
    date "2026-04-24"
    color "green"
  ]
  edge [
    source 2
    target 25
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 26
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 28
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 30
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 33
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 2
    target 34
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 3
    target 5
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 3
    target 4
    relation "co_occurs"
    weight 0.1
    date "2019-05-01"
    color "lightgray"
  ]
  edge [
    source 3
    target 22
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 3
    target 21
    relation "co_occurs"
    weight 0.1
    date "2026-04-24"
    color "lightgray"
  ]
  edge [
    source 3
    target 2
    relation "co_occurs"
    weight 0.1
    date "2026-04-24"
    color "lightgray"
  ]
  edge [
    source 3
    target 32
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 4
    target 5
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 6
    target 9
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 6
    target 7
    relation "co_occurs"
    weight 0.1
    date "2023-07-31"
    color "lightgray"
  ]
  edge [
    source 6
    target 0
    relation "co_occurs"
    weight 0.1
    date "2023-07-31"
    color "lightgray"
  ]
  edge [
    source 6
    target 8
    relation "co_occurs"
    weight 0.1
    date "2023-07-31"
    color "lightgray"
  ]
  edge [
    source 6
    target 2
    relation "co_occurs"
    weight 0.1
    date "2023-07-31"
    color "lightgray"
  ]
  edge [
    source 6
    target 10
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 6
    target 1
    relation "co_occurs"
    weight 0.1
    date "2023-11-20"
    color "lightgray"
  ]
  edge [
    source 7
    target 9
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 7
    target 2
    relation "co_occurs"
    weight 0.1
    date "2023-07-31"
    color "lightgray"
  ]
  edge [
    source 8
    target 9
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 8
    target 2
    relation "co_occurs"
    weight 0.1
    date "2023-07-31"
    color "lightgray"
  ]
  edge [
    source 8
    target 19
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 10
    target 6
    relation "DEFEND"
    color "#2c3e50"
  ]
  edge [
    source 10
    target 17
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 10
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 11
    target 12
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 11
    target 2
    relation "co_occurs"
    weight 0.1
    date "2024-03-21"
    color "lightgray"
  ]
  edge [
    source 15
    target 17
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 15
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 16
    target 17
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 16
    target 2
    relation "co_occurs"
    weight 0.1
    date "2026-04-02"
    color "lightgray"
  ]
  edge [
    source 16
    target 23
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 17
    target 16
    relation "REMOVE"
    color "#2c3e50"
  ]
  edge [
    source 17
    target 22
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 17
    target 23
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 17
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 18
    target 17
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 18
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 20
    target 17
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 20
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 21
    target 22
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 21
    target 2
    relation "co_occurs"
    weight 0.1
    date "2026-04-24"
    color "lightgray"
  ]
  edge [
    source 22
    target 3
    relation "RESIGN"
    color "#2c3e50"
  ]
  edge [
    source 22
    target 34
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 22
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 23
    target 1
    relation "JOIN"
    color "#2c3e50"
  ]
  edge [
    source 23
    target 34
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 23
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 24
    target 25
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 24
    target 2
    relation "co_occurs"
    weight 0.1
    date "2026-04-24"
    color "lightgray"
  ]
  edge [
    source 26
    target 17
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 26
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 27
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 28
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 29
    target 30
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 29
    target 2
    relation "co_occurs"
    weight 0.1
    date "2026-04-27"
    color "lightgray"
  ]
  edge [
    source 31
    target 32
    relation "involved_in"
    color "#9b59b6"
  ]
  edge [
    source 31
    target 3
    relation "co_occurs"
    weight 0.1
    date "2026-04-27"
    color "lightgray"
  ]
  edge [
    source 33
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
  edge [
    source 34
    target 27
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 34
    target 28
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 34
    target 33
    relation "leads_to"
    color "#c0392b"
    weight 2.0
  ]
  edge [
    source 34
    target 2
    relation "CENTRAL_FIGURE"
    color "#f1c40f"
    weight 3.0
  ]
]

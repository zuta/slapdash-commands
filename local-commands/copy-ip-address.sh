#!/usr/bin/env bash

public_ip=$(curl ipecho.net/plain 2>/dev/null)
private_ip=$(ipconfig getifaddr en0)

printf '{
  "view": {
    "type": "list",
    "options": [
      {
        "title": "Public IP Address",
        "subtitle": "%s",
        "action": {
          "type": "copy",
          "value": "%s"
        }
      },
      {
        "title": "Private IP Address",
        "subtitle": "%s",
        "action": {
          "type": "copy",
          "value": "%s"
        }
      }
    ]
  }
}' "$public_ip" "$public_ip" "$private_ip" "$private_ip"

#!/bin/bash
# Confere quais metricas do Cloud Monitoring tem dados no projeto (usado para montar o Painel de uso)
T=$(gcloud auth print-access-token); P=portal-educador-5
FIM=$(date -u +%Y-%m-%dT%H:%M:%SZ); INI=$(date -u -d '-30 days' +%Y-%m-%dT%H:%M:%SZ)
for M in firestore.googleapis.com/document/read_count firestore.googleapis.com/document/write_count firestore.googleapis.com/document/delete_count \
  firestore.googleapis.com/storage/data_and_index_storage_bytes storage.googleapis.com/storage/total_bytes storage.googleapis.com/storage/object_count \
  storage.googleapis.com/network/sent_bytes_count run.googleapis.com/request_count; do
  R=$(curl -s -G -H "Authorization: Bearer $T" "https://monitoring.googleapis.com/v3/projects/$P/timeSeries" \
    --data-urlencode "filter=metric.type=\"$M\"" --data-urlencode "interval.startTime=$INI" --data-urlencode "interval.endTime=$FIM" \
    --data-urlencode "aggregation.alignmentPeriod=86400s" --data-urlencode "aggregation.perSeriesAligner=ALIGN_MAX" --data-urlencode "view=HEADERS")
  echo "$M => series: $(echo "$R" | grep -c '"metric"') erro: $(echo "$R" | grep -o '"message": "[^"]*' | head -1)"
done

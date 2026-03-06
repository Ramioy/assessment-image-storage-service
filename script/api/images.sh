#!/usr/bin/env bash
# Product image operations — upload, list, serve, delete.
#
# list and serve are public (no API key). upload and delete require API key
# when API_KEY_ENABLED=true.
#
# Usage:
#   ./images.sh upload     <productId> <file-path>
#   ./images.sh list       <productId>
#   ./images.sh serve      <productId> <imageId> [output-file]
#   ./images.sh delete     <productId> <imageId>
#   ./images.sh delete-all <productId>

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

CMD="${1:-}"

case "$CMD" in
  upload)
    PRODUCT_ID="${2:?Usage: $0 upload <productId> <file-path>}"
    FILE_PATH="${3:?Usage: $0 upload <productId> <file-path>}"

    if [ ! -f "$FILE_PATH" ]; then
      echo "Error: file not found: $FILE_PATH"
      exit 1
    fi

    echo "POST $BASE_URL/products/$PRODUCT_ID/images"
    echo "     file: $FILE_PATH"
    _curl_auth \
      -X POST \
      -F "file=@${FILE_PATH}" \
      "$BASE_URL/products/$PRODUCT_ID/images" | _pretty
    ;;

  list)
    PRODUCT_ID="${2:?Usage: $0 list <productId>}"

    echo "GET $BASE_URL/products/$PRODUCT_ID/images"
    curl -s "$BASE_URL/products/$PRODUCT_ID/images" | _pretty
    ;;

  serve)
    PRODUCT_ID="${2:?Usage: $0 serve <productId> <imageId> [output-file]}"
    IMAGE_ID="${3:?Usage: $0 serve <productId> <imageId> [output-file]}"
    OUTPUT_FILE="${4:-}"

    URL="$BASE_URL/products/$PRODUCT_ID/images/$IMAGE_ID"

    if [ -n "$OUTPUT_FILE" ]; then
      echo "GET $URL  ->  $OUTPUT_FILE"
      curl -s -o "$OUTPUT_FILE" -w "HTTP %{http_code}  Content-Type: %{content_type}  Size: %{size_download} bytes\n" "$URL"
    else
      # Detect content type and write to a timestamped file in the current directory
      TMPFILE="image-$(date +%s)"
      HTTP_INFO="$(curl -s -o "$TMPFILE" -w "%{http_code} %{content_type}" "$URL")"
      HTTP_CODE="$(echo "$HTTP_INFO" | cut -d' ' -f1)"
      CONTENT_TYPE="$(echo "$HTTP_INFO" | cut -d' ' -f2)"

      if [ "$HTTP_CODE" = "200" ]; then
        # Derive extension from content type
        case "$CONTENT_TYPE" in
          image/jpeg*) EXT="jpg" ;;
          image/png*)  EXT="png" ;;
          image/webp*) EXT="webp" ;;
          image/gif*)  EXT="gif" ;;
          *)           EXT="bin" ;;
        esac

        FINAL="$IMAGE_ID.$EXT"
        mv "$TMPFILE" "$FINAL"
        echo "GET $URL"
        echo "    Saved: $FINAL  ($CONTENT_TYPE)"
      else
        cat "$TMPFILE" | _pretty
        rm -f "$TMPFILE"
      fi
    fi
    ;;

  delete)
    PRODUCT_ID="${2:?Usage: $0 delete <productId> <imageId>}"
    IMAGE_ID="${3:?Usage: $0 delete <productId> <imageId>}"

    echo "DELETE $BASE_URL/products/$PRODUCT_ID/images/$IMAGE_ID"
    _curl_auth \
      -X DELETE \
      -w "\nHTTP %{http_code}\n" \
      "$BASE_URL/products/$PRODUCT_ID/images/$IMAGE_ID"
    ;;

  delete-all)
    PRODUCT_ID="${2:?Usage: $0 delete-all <productId>}"

    echo "DELETE $BASE_URL/products/$PRODUCT_ID/images"
    _curl_auth \
      -X DELETE \
      -w "\nHTTP %{http_code}\n" \
      "$BASE_URL/products/$PRODUCT_ID/images"
    ;;

  "")
    echo "Usage: $0 <command> [args]"
    echo ""
    echo "Commands:"
    echo "  upload     <productId> <file-path>            Upload an image file"
    echo "  list       <productId>                        List image IDs for a product"
    echo "  serve      <productId> <imageId> [out-file]   Download an image binary"
    echo "  delete     <productId> <imageId>              Delete a single image"
    echo "  delete-all <productId>                        Delete all images for a product"
    echo ""
    echo "Environment variables:"
    echo "  BASE_URL          (default: http://localhost:3001/api/development/v1)"
    echo "  NODE_ENV          (default: development)"
    echo "  API_KEY_ENABLED   (default: false)"
    echo "  API_KEY           (default: your-development-secret-key-change-in-production)"
    exit 1
    ;;

  *)
    echo "Unknown command: $CMD"
    echo "Commands: upload | list | serve | delete | delete-all"
    exit 1
    ;;
esac

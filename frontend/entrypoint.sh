#!/bin/sh
set -e

# 1) replace the placeholder in your main JS bundle
#    you might need to tweak the glob if your filename is hashed differently
for file in /usr/share/nginx/html/static/js/main.*.js; do
  # this looks for the literal string $REACT_APP_NEWSLETTER_FUNCTION_URL
  envsubst '\$REACT_APP_NEWSLETTER_FUNCTION_URL' \
    < "$file" \
    > "${file}.tmp" \
    && mv "${file}.tmp" "$file"
done

# 2) hand off to nginx
exec "$@"

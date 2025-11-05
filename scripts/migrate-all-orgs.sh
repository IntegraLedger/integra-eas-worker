#!/bin/bash

# Script to migrate all org databases
# Adds attestations table to all org-db-* databases

set -e

MIGRATION_FILE="migrations/001_create_attestations_table.sql"
LOG_FILE="migration-results-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "Migrating all org databases"
echo "Migration file: $MIGRATION_FILE"
echo "Log file: $LOG_FILE"
echo "================================================"
echo ""

# Initialize counters
TOTAL=0
SUCCESS=0
FAILED=0
SKIPPED=0

# Get list of all org databases
echo "Fetching list of org databases..."
ORG_DBS=$(wrangler d1 list --json | jq -r '.[] | select(.name | startswith("org-db-")) | .name' 2>/dev/null)

if [ -z "$ORG_DBS" ]; then
    echo -e "${RED}Error: No org databases found${NC}"
    exit 1
fi

# Count total databases
TOTAL=$(echo "$ORG_DBS" | wc -l | tr -d ' ')
echo "Found $TOTAL org databases"
echo ""

# Log header
echo "Migration started at $(date)" > "$LOG_FILE"
echo "Total databases: $TOTAL" >> "$LOG_FILE"
echo "----------------------------------------" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Iterate through each database
CURRENT=0
for db in $ORG_DBS; do
    CURRENT=$((CURRENT + 1))
    echo -e "${YELLOW}[$CURRENT/$TOTAL]${NC} Migrating $db..."

    # Check if table already exists
    TABLE_CHECK=$(wrangler d1 execute "$db" --command "SELECT name FROM sqlite_master WHERE type='table' AND name='attestations';" --remote 2>&1)

    if echo "$TABLE_CHECK" | grep -q '"name": "attestations"'; then
        echo -e "${YELLOW}  ⊘ Table already exists, skipping${NC}"
        echo "[$CURRENT/$TOTAL] $db - SKIPPED (table exists)" >> "$LOG_FILE"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    # Run migration
    RESULT=$(wrangler d1 execute "$db" --file="$MIGRATION_FILE" --remote 2>&1)

    if echo "$RESULT" | grep -q '"success": true'; then
        echo -e "${GREEN}  ✓ Success${NC}"
        echo "[$CURRENT/$TOTAL] $db - SUCCESS" >> "$LOG_FILE"
        SUCCESS=$((SUCCESS + 1))
    else
        echo -e "${RED}  ✗ Failed${NC}"
        echo "[$CURRENT/$TOTAL] $db - FAILED" >> "$LOG_FILE"
        echo "  Error: $RESULT" >> "$LOG_FILE"
        FAILED=$((FAILED + 1))
    fi

    # Small delay to avoid rate limiting
    sleep 0.5
done

# Summary
echo ""
echo "================================================"
echo "Migration Complete"
echo "================================================"
echo -e "Total databases: ${YELLOW}$TOTAL${NC}"
echo -e "Successful:      ${GREEN}$SUCCESS${NC}"
echo -e "Skipped:         ${YELLOW}$SKIPPED${NC}"
echo -e "Failed:          ${RED}$FAILED${NC}"
echo ""
echo "Detailed log: $LOG_FILE"
echo "================================================"

# Write summary to log
echo "" >> "$LOG_FILE"
echo "----------------------------------------" >> "$LOG_FILE"
echo "Migration completed at $(date)" >> "$LOG_FILE"
echo "Total: $TOTAL | Success: $SUCCESS | Skipped: $SKIPPED | Failed: $FAILED" >> "$LOG_FILE"

# Exit with error if any failed
if [ $FAILED -gt 0 ]; then
    exit 1
fi

exit 0

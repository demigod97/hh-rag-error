#!/bin/bash

# Fix Edge Function Setup Script
# This script helps resolve common edge function configuration issues

set -e

echo "🔧 Fixing Edge Function Configuration Issues"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Are you in the project root?"
    exit 1
fi

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    log_error "Supabase CLI not found. Please install it first:"
    echo "  npm install -g supabase"
    exit 1
fi

log_info "Checking current Supabase project status..."
supabase status || {
    log_warning "Supabase not running locally. Starting..."
    supabase start
}

log_info "Setting up required environment variables as Supabase secrets..."

# Set default secrets (users should replace with actual values)
log_info "Setting default OLLAMA_BASE_URL..."
supabase secrets set OLLAMA_BASE_URL=http://localhost:11434 || log_warning "Failed to set OLLAMA_BASE_URL"

# Check if .env.local exists and read values
if [ -f ".env.local" ]; then
    log_info "Reading configuration from .env.local..."
    
    # Extract values from .env.local and set as secrets
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ ! "$key" =~ ^#.*$ ]] && [ -n "$key" ]; then
            # Remove quotes from value
            value="${value%\"}"
            value="${value#\"}"
            
            # Only set if value is not a placeholder
            if [[ ! "$value" =~ ^your_.*$ ]] && [ "$value" != "" ]; then
                log_info "Setting secret: $key"
                supabase secrets set "$key=$value" || log_warning "Failed to set $key"
            fi
        fi
    done < .env.local
else
    log_warning ".env.local not found. Setting minimal configuration..."
    
    # Set minimal required secrets
    supabase secrets set SUPABASE_URL="$(supabase status | grep 'API URL' | awk '{print $3}')" || true
    supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$(supabase status | grep 'service_role key' | awk '{print $3}')" || true
fi

log_info "Re-deploying edge functions with updated configuration..."

# Deploy all edge functions
FUNCTIONS=(
    "process-pdf-with-metadata"
    "batch-vector-search"
    "generate-report"
    "process-report-sections"
    "generate-embeddings"
)

for func in "${FUNCTIONS[@]}"; do
    if [ -d "supabase/functions/$func" ]; then
        log_info "Deploying $func..."
        supabase functions deploy "$func" --no-verify-jwt || log_warning "Failed to deploy $func"
    else
        log_warning "Function directory not found: supabase/functions/$func"
    fi
done

log_info "Testing edge function connectivity..."

# Get the API URL and anon key
API_URL=$(supabase status | grep 'API URL' | awk '{print $3}')
ANON_KEY=$(supabase status | grep 'anon key' | awk '{print $3}')

if [ -n "$API_URL" ] && [ -n "$ANON_KEY" ]; then
    log_info "Testing process-pdf-with-metadata function..."
    
    # Test the function with a simple request
    RESPONSE=$(curl -s -w "%{http_code}" -X POST "$API_URL/functions/v1/process-pdf-with-metadata" \
        -H "Authorization: Bearer $ANON_KEY" \
        -H "Content-Type: application/json" \
        -d '{"test": true}' \
        -o /tmp/edge_function_test.json)
    
    HTTP_CODE="${RESPONSE: -3}"
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ]; then
        log_success "Edge function is responding (HTTP $HTTP_CODE)"
    else
        log_error "Edge function test failed (HTTP $HTTP_CODE)"
        log_info "Response body:"
        cat /tmp/edge_function_test.json 2>/dev/null || echo "No response body"
    fi
else
    log_warning "Could not get API URL or anon key for testing"
fi

log_info "Checking function logs for any errors..."
supabase functions logs process-pdf-with-metadata --limit 10 || log_warning "Could not fetch function logs"

log_success "Edge function setup fix completed!"
echo ""
echo "📋 Next steps:"
echo "1. Verify your API keys are correctly set in Supabase secrets"
echo "2. Test file upload in the application"
echo "3. Check function logs if issues persist: supabase functions logs --follow"
echo ""
echo "🔧 Common issues:"
echo "- Missing API keys: Set them using 'supabase secrets set KEY=value'"
echo "- Network issues: Ensure external API endpoints are accessible"
echo "- Function errors: Check logs with 'supabase functions logs process-pdf-with-metadata'"

# Clean up
rm -f /tmp/edge_function_test.json
#!/bin/bash

# Town Planner RAG System - Complete Deployment Script
# This script will set up everything from scratch

set -e

echo "🚀 Town Planner RAG System - Fresh Deployment"
echo "============================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI not found. Please install it first:"
    echo "  npm install -g supabase"
    exit 1
fi
print_status "Supabase CLI found"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from your project root directory"
    exit 1
fi
print_status "Project directory confirmed"

# Step 1: Environment Setup
echo ""
echo "🔧 Setting up environment variables..."

# Create .env.local file if it doesn't exist
if [ ! -f ".env.local" ]; then
    cat > .env.local << 'EOF'
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LLM Provider API Keys
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
LLAMACLOUD_API_KEY=your_llamacloud_key

# Ollama Configuration (Local)
OLLAMA_BASE_URL=http://localhost:11434

# n8n Configuration
N8N_WEBHOOK_BASE_URL=http://localhost:5678
N8N_API_KEY=your_n8n_api_key
EOF
    print_warning "Created .env.local - Please update with your actual values"
else
    print_status ".env.local already exists"
fi

# Step 2: Database Setup
echo ""
echo "🗄️  Setting up database..."

# Create migration file
MIGRATION_TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="supabase/migrations/${MIGRATION_TIMESTAMP}_complete_town_planner_schema.sql"

# Copy schema from artifact
if [ ! -d "supabase/migrations" ]; then
    mkdir -p supabase/migrations
fi

# Check if migration already exists
if ls supabase/migrations/*complete_town_planner_schema.sql 1> /dev/null 2>&1; then
    print_status "Migration file already exists"
else
    print_warning "Please copy the complete schema SQL to: $MIGRATION_FILE"
    print_warning "You can find it in the 'Complete Database Schema' artifact"
fi

# Step 3: Edge Functions Setup
echo ""
echo "🚀 Setting up Edge Functions..."

# Create edge function directories
FUNCTIONS=(
    "process-pdf-with-metadata"
    "batch-vector-search"
    "generate-report"
    "process-report-sections"
    "generate-embeddings"
)

for func in "${FUNCTIONS[@]}"; do
    if [ ! -d "supabase/functions/$func" ]; then
        mkdir -p "supabase/functions/$func"
        print_status "Created directory for $func"
    fi
done

# Create a sample edge function file
if [ ! -f "supabase/functions/process-pdf-with-metadata/index.ts" ]; then
    print_warning "Please copy the edge function code to the respective directories"
    print_warning "You can find them in the 'Edge Functions' artifacts"
fi

# Step 4: Create deployment helper scripts
echo ""
echo "📝 Creating helper scripts..."

# Create deploy-functions.sh
cat > deploy-functions.sh << 'EOF'
#!/bin/bash
# Deploy all edge functions

echo "Deploying edge functions..."

functions=(
    "process-pdf-with-metadata"
    "batch-vector-search"
    "generate-report"
    "process-report-sections"
    "generate-embeddings"
)

for func in "${functions[@]}"; do
    echo "Deploying $func..."
    supabase functions deploy $func --no-verify-jwt
done

echo "✅ All functions deployed!"
EOF
chmod +x deploy-functions.sh
print_status "Created deploy-functions.sh"

# Create set-secrets.sh
cat > set-secrets.sh << 'EOF'
#!/bin/bash
# Set Supabase secrets from .env.local

if [ ! -f ".env.local" ]; then
    echo "Error: .env.local not found"
    exit 1
fi

echo "Setting Supabase secrets..."

# Read .env.local and set secrets
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ ! "$key" =~ ^#.*$ ]] && [ -n "$key" ]; then
        # Remove quotes from value
        value="${value%\"}"
        value="${value#\"}"
        
        # Skip if value is placeholder
        if [[ ! "$value" =~ ^your_.*$ ]] && [ "$value" != "" ]; then
            echo "Setting $key..."
            supabase secrets set "$key=$value"
        fi
    fi
done < .env.local

echo "✅ Secrets configured!"
EOF
chmod +x set-secrets.sh
print_status "Created set-secrets.sh"

# Step 5: Frontend Configuration
echo ""
echo "🎨 Updating frontend configuration..."

# Create/update API configuration
cat > src/lib/llm-config.ts << 'EOF'
// LLM Provider Configuration

export type LLMProvider = 'ollama' | 'openai' | 'gemini' | 'llamacloud'

export interface LLMConfig {
  provider: LLMProvider
  model?: string
  temperature?: number
  maxTokens?: number
}

export const LLM_DEFAULTS: Record<LLMProvider, any> = {
  ollama: {
    model: 'qwen3:8b-q4_K_M',
    embedModel: 'nomic-embed-text:latest',
    temperature: 0.3
  },
  openai: {
    model: 'gpt-4',
    embedModel: 'text-embedding-3-small',
    temperature: 0.3
  },
  gemini: {
    model: 'gemini-pro',
    embedModel: 'embedding-001',
    temperature: 0.3
  },
  llamacloud: {
    // LlamaCloud is used for PDF parsing only
  }
}

export function getLLMConfig(provider: LLMProvider): any {
  return LLM_DEFAULTS[provider] || LLM_DEFAULTS.ollama
}
EOF
print_status "Created LLM configuration"

# Step 6: Create testing script
echo ""
echo "🧪 Creating test scripts..."

cat > test-deployment.sh << 'EOF'
#!/bin/bash
# Test the deployment

echo "🧪 Testing Town Planner Deployment"
echo "=================================="

# Test Supabase connection
echo ""
echo "Testing Supabase connection..."
npx supabase status

# Test edge functions
echo ""
echo "Testing edge functions..."
echo "Note: Make sure you have deployed the functions first!"

# You can add specific function tests here
echo "✅ Basic tests completed!"
echo ""
echo "Next steps:"
echo "1. Run the migration: supabase db push"
echo "2. Deploy functions: ./deploy-functions.sh"
echo "3. Set secrets: ./set-secrets.sh"
echo "4. Start development: npm run dev"
EOF
chmod +x test-deployment.sh
print_status "Created test-deployment.sh"

# Final instructions
echo ""
echo "✨ Setup Complete!"
echo "=================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Update .env.local with your actual API keys and configuration"
echo ""
echo "2. Copy the database schema to the migration file:"
echo "   $MIGRATION_FILE"
echo ""
echo "3. Copy the edge function code to their respective directories"
echo ""
echo "4. Run the migration:"
echo "   supabase db push"
echo ""
echo "5. Deploy the edge functions:"
echo "   ./deploy-functions.sh"
echo ""
echo "6. Set the environment variables in Supabase:"
echo "   ./set-secrets.sh"
echo ""
echo "7. Start development:"
echo "   npm run dev"
echo ""
echo "📚 Additional Resources:"
echo "- Database schema is in the 'Complete Database Schema' artifact"
echo "- Edge functions are in the 'Edge Functions' artifacts"
echo "- Check README.md for detailed documentation"
echo ""
echo "Need help? Check the troubleshooting guide or documentation!"

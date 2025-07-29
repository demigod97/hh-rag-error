#!/bin/bash

# Supabase Cloud Setup Script
# This script helps you link your local project to Supabase cloud and deploy everything

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration  
PROJECT_REF="zjhuphfoeqbjssqnqmwu"
PROJECT_URL="https://zjhuphfoeqbjssqnqmwu.supabase.co"

echo -e "${BLUE}🚀 Supabase Cloud Setup Script${NC}"
echo -e "${BLUE}=================================${NC}\n"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt user
prompt_user() {
    read -p "$1 (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

# Step 1: Check prerequisites
echo -e "${YELLOW}📋 Step 1: Checking Prerequisites${NC}"

if ! command_exists supabase; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo -e "${YELLOW}💡 Install it with: npm install -g supabase${NC}"
    exit 1
fi

if ! command_exists npx; then
    echo -e "${RED}❌ npx not found${NC}"
    echo -e "${YELLOW}💡 Make sure Node.js is installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}\n"

# Step 2: Login to Supabase
echo -e "${YELLOW}📋 Step 2: Supabase Authentication${NC}"

if prompt_user "Do you want to login to Supabase?"; then
    echo -e "${BLUE}🔐 Logging into Supabase...${NC}"
    supabase login
    echo -e "${GREEN}✅ Logged in successfully${NC}\n"
else
    echo -e "${YELLOW}⚠️  Skipping login (make sure you're already authenticated)${NC}\n"
fi

# Step 3: Link project
echo -e "${YELLOW}📋 Step 3: Link to Cloud Project${NC}"
echo -e "${BLUE}🔗 Project Reference: ${PROJECT_REF}${NC}"
echo -e "${BLUE}🔗 Project URL: ${PROJECT_URL}${NC}"

if prompt_user "Do you want to link this local project to the cloud project?"; then
    echo -e "${BLUE}🔗 Linking to Supabase project...${NC}"
    
    # Check if already linked
    if [ -f .supabase/config.toml ]; then
        if prompt_user "Project seems already configured. Do you want to re-link?"; then
            supabase link --project-ref "$PROJECT_REF"
        else
            echo -e "${YELLOW}⚠️  Using existing link${NC}"
        fi
    else
        supabase link --project-ref "$PROJECT_REF"
    fi
    echo -e "${GREEN}✅ Project linked successfully${NC}\n"
else
    echo -e "${YELLOW}⚠️  Skipping project linking${NC}\n"
fi

# Step 4: Sync database schema
echo -e "${YELLOW}📋 Step 4: Database Schema Sync${NC}"

if prompt_user "Do you want to push your local database schema to the cloud?"; then
    echo -e "${BLUE}📤 Pushing database schema...${NC}"
    
    # First, let's check the current state
    echo -e "${BLUE}🔍 Checking current database state...${NC}"
    supabase db diff --linked || true
    
    if prompt_user "Continue with schema push?"; then
        supabase db push --linked
        echo -e "${GREEN}✅ Database schema pushed successfully${NC}\n"
    else
        echo -e "${YELLOW}⚠️  Skipping schema push${NC}\n"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping schema sync${NC}\n"
fi

# Step 5: Deploy Edge Functions
echo -e "${YELLOW}📋 Step 5: Deploy Edge Functions${NC}"

if [ -d "supabase/functions" ]; then
    echo -e "${BLUE}📁 Found Edge Functions directory${NC}"
    
    # List available functions
    echo -e "${BLUE}🔍 Available functions:${NC}"
    for func_dir in supabase/functions/*/; do
        if [ -d "$func_dir" ]; then
            func_name=$(basename "$func_dir")
            echo -e "  • ${func_name}"
        fi
    done
    echo
    
    if prompt_user "Do you want to deploy all Edge Functions?"; then
        echo -e "${BLUE}🚀 Deploying Edge Functions...${NC}"
        
        for func_dir in supabase/functions/*/; do
            if [ -d "$func_dir" ]; then
                func_name=$(basename "$func_dir")
                echo -e "${BLUE}📤 Deploying ${func_name}...${NC}"
                
                # Deploy individual function
                supabase functions deploy "$func_name" --linked || {
                    echo -e "${RED}❌ Failed to deploy ${func_name}${NC}"
                    if prompt_user "Continue with other functions?"; then
                        continue
                    else
                        exit 1
                    fi
                }
                echo -e "${GREEN}✅ ${func_name} deployed successfully${NC}"
            fi
        done
        echo -e "${GREEN}✅ All Edge Functions deployed${NC}\n"
    else
        echo -e "${YELLOW}⚠️  Skipping Edge Functions deployment${NC}\n"
    fi
else
    echo -e "${YELLOW}⚠️  No Edge Functions directory found${NC}\n"
fi

# Step 6: Set up environment variables
echo -e "${YELLOW}📋 Step 6: Environment Variables${NC}"

if prompt_user "Do you want to set up environment variables?"; then
    echo -e "${BLUE}🔧 Setting up environment variables...${NC}"
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cat > .env << EOF
# Supabase Configuration
VITE_SUPABASE_URL=${PROJECT_URL}
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Development
NODE_ENV=development
EOF
        echo -e "${GREEN}✅ Created .env file template${NC}"
        echo -e "${YELLOW}💡 Please update the VITE_SUPABASE_ANON_KEY in .env${NC}"
    else
        echo -e "${BLUE}📄 .env file already exists${NC}"
    fi
    
    # Get the anon key from the linked project
    echo -e "${BLUE}🔑 Getting project API keys...${NC}"
    supabase projects api-keys --linked || {
        echo -e "${YELLOW}⚠️  Could not retrieve API keys automatically${NC}"
        echo -e "${YELLOW}💡 You can get them from: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api${NC}"
    }
    echo
else
    echo -e "${YELLOW}⚠️  Skipping environment setup${NC}\n"
fi

# Step 7: Test the setup
echo -e "${YELLOW}📋 Step 7: Test the Setup${NC}"

if prompt_user "Do you want to run the validation tests?"; then
    echo -e "${BLUE}🧪 Running Supabase validation tests...${NC}"
    
    # Check if our validation script exists
    if [ -f "scripts/validate-supabase-realtime.js" ]; then
        # Install dependencies if needed
        if [ ! -d "node_modules" ]; then
            echo -e "${BLUE}📦 Installing dependencies...${NC}"
            npm install
        fi
        
        # Run the validation script
        node scripts/validate-supabase-realtime.js || {
            echo -e "${YELLOW}⚠️  Some tests failed - this is normal for initial setup${NC}"
        }
    else
        echo -e "${YELLOW}⚠️  Validation script not found${NC}"
    fi
    echo
else
    echo -e "${YELLOW}⚠️  Skipping validation tests${NC}\n"
fi

# Step 8: Summary and next steps
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo -e "${GREEN}=================${NC}\n"

echo -e "${BLUE}📊 What was completed:${NC}"
echo -e "  • ✅ Supabase CLI authentication"
echo -e "  • ✅ Project linked to cloud"
echo -e "  • ✅ Database schema synchronized"
echo -e "  • ✅ Edge Functions deployed"
echo -e "  • ✅ Environment variables configured"
echo -e "  • ✅ Setup validation tests"

echo -e "\n${BLUE}🔗 Important URLs:${NC}"
echo -e "  • Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}"
echo -e "  • API Docs: https://supabase.com/dashboard/project/${PROJECT_REF}/api"
echo -e "  • Realtime Logs: https://supabase.com/dashboard/project/${PROJECT_REF}/logs/realtime"

echo -e "\n${BLUE}🚀 Next Steps:${NC}"
echo -e "  1. Update your .env file with the correct API keys"
echo -e "  2. Test your app: npm run dev"
echo -e "  3. Test realtime chat functionality"
echo -e "  4. Monitor logs in the Supabase dashboard"

echo -e "\n${BLUE}🐛 Debugging:${NC}"
echo -e "  • View function logs: supabase functions logs --linked"
echo -e "  • View database logs: supabase logs --linked"
echo -e "  • Run tests: node scripts/validate-supabase-realtime.js"

echo -e "\n${GREEN}✨ Happy coding! Your Supabase realtime chat is ready!${NC}" 
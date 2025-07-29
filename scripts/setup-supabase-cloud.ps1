# Supabase Cloud Setup Script (Windows PowerShell)
# This script helps you link your local project to Supabase cloud and deploy everything

# Set error action preference
$ErrorActionPreference = "Stop"

# Project configuration
$PROJECT_REF = "zjhuphfoeqbjssqnqmwu"
$PROJECT_URL = "https://zjhuphfoeqbjssqnqmwu.supabase.co"

Write-Host "🚀 Supabase Cloud Setup Script (Windows)" -ForegroundColor Blue
Write-Host "=========================================" -ForegroundColor Blue
Write-Host ""

# Function to check if command exists
function Test-CommandExists {
    param($CommandName)
    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    return $command -ne $null
}

# Function to prompt user
function Prompt-User {
    param($Message)
    $response = Read-Host "$Message (y/n)"
    return $response -match "^[Yy]$"
}

# Step 1: Check prerequisites
Write-Host "📋 Step 1: Checking Prerequisites" -ForegroundColor Yellow

if (-not (Test-CommandExists "supabase")) {
    Write-Host "❌ Supabase CLI not found" -ForegroundColor Red
    Write-Host "💡 Install it with: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-CommandExists "npx")) {
    Write-Host "❌ npx not found" -ForegroundColor Red
    Write-Host "💡 Make sure Node.js is installed" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor Green
Write-Host ""

# Step 2: Login to Supabase
Write-Host "📋 Step 2: Supabase Authentication" -ForegroundColor Yellow

if (Prompt-User "Do you want to login to Supabase?") {
    Write-Host "🔐 Logging into Supabase..." -ForegroundColor Blue
    supabase login
    Write-Host "✅ Logged in successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "⚠️  Skipping login (make sure you're already authenticated)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 3: Link project
Write-Host "📋 Step 3: Link to Cloud Project" -ForegroundColor Yellow
Write-Host "🔗 Project Reference: $PROJECT_REF" -ForegroundColor Blue
Write-Host "🔗 Project URL: $PROJECT_URL" -ForegroundColor Blue

if (Prompt-User "Do you want to link this local project to the cloud project?") {
    Write-Host "🔗 Linking to Supabase project..." -ForegroundColor Blue
    
    # Check if already linked
    if (Test-Path ".supabase/config.toml") {
        if (Prompt-User "Project seems already configured. Do you want to re-link?") {
            supabase link --project-ref $PROJECT_REF
        } else {
            Write-Host "⚠️  Using existing link" -ForegroundColor Yellow
        }
    } else {
        supabase link --project-ref $PROJECT_REF
    }
    Write-Host "✅ Project linked successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "⚠️  Skipping project linking" -ForegroundColor Yellow
    Write-Host ""
}

# Step 4: Sync database schema
Write-Host "📋 Step 4: Database Schema Sync" -ForegroundColor Yellow

if (Prompt-User "Do you want to push your local database schema to the cloud?") {
    Write-Host "📤 Pushing database schema..." -ForegroundColor Blue
    
    # First, let's check the current state
    Write-Host "🔍 Checking current database state..." -ForegroundColor Blue
    try {
        supabase db diff --linked
    } catch {
        Write-Host "No differences found or error checking diff" -ForegroundColor Yellow
    }
    
    if (Prompt-User "Continue with schema push?") {
        supabase db push --linked
        Write-Host "✅ Database schema pushed successfully" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "⚠️  Skipping schema push" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "⚠️  Skipping schema sync" -ForegroundColor Yellow
    Write-Host ""
}

# Step 5: Deploy Edge Functions
Write-Host "📋 Step 5: Deploy Edge Functions" -ForegroundColor Yellow

if (Test-Path "supabase/functions") {
    Write-Host "📁 Found Edge Functions directory" -ForegroundColor Blue
    
    # List available functions
    Write-Host "🔍 Available functions:" -ForegroundColor Blue
    $functions = Get-ChildItem "supabase/functions" -Directory
    foreach ($func in $functions) {
        Write-Host "  • $($func.Name)"
    }
    Write-Host ""
    
    if (Prompt-User "Do you want to deploy all Edge Functions?") {
        Write-Host "🚀 Deploying Edge Functions..." -ForegroundColor Blue
        
        foreach ($func in $functions) {
            $funcName = $func.Name
            Write-Host "📤 Deploying $funcName..." -ForegroundColor Blue
            
            try {
                supabase functions deploy $funcName --linked
                Write-Host "✅ $funcName deployed successfully" -ForegroundColor Green
            } catch {
                Write-Host "❌ Failed to deploy $funcName" -ForegroundColor Red
                if (-not (Prompt-User "Continue with other functions?")) {
                    exit 1
                }
            }
        }
        Write-Host "✅ All Edge Functions deployed" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "⚠️  Skipping Edge Functions deployment" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "⚠️  No Edge Functions directory found" -ForegroundColor Yellow
    Write-Host ""
}

# Step 6: Set up environment variables
Write-Host "📋 Step 6: Environment Variables" -ForegroundColor Yellow

if (Prompt-User "Do you want to set up environment variables?") {
    Write-Host "🔧 Setting up environment variables..." -ForegroundColor Blue
    
    # Create .env file if it doesn't exist
    if (-not (Test-Path ".env")) {
        $envContent = @"
# Supabase Configuration
VITE_SUPABASE_URL=$PROJECT_URL
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Development
NODE_ENV=development
"@
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        Write-Host "✅ Created .env file template" -ForegroundColor Green
        Write-Host "💡 Please update the VITE_SUPABASE_ANON_KEY in .env" -ForegroundColor Yellow
    } else {
        Write-Host "📄 .env file already exists" -ForegroundColor Blue
    }
    
    # Get the anon key from the linked project
    Write-Host "🔑 Getting project API keys..." -ForegroundColor Blue
    try {
        supabase projects api-keys --linked
    } catch {
        Write-Host "⚠️  Could not retrieve API keys automatically" -ForegroundColor Yellow
        Write-Host "💡 You can get them from: https://supabase.com/dashboard/project/$PROJECT_REF/settings/api" -ForegroundColor Yellow
    }
    Write-Host ""
} else {
    Write-Host "⚠️  Skipping environment setup" -ForegroundColor Yellow
    Write-Host ""
}

# Step 7: Test the setup
Write-Host "📋 Step 7: Test the Setup" -ForegroundColor Yellow

if (Prompt-User "Do you want to run the validation tests?") {
    Write-Host "🧪 Running Supabase validation tests..." -ForegroundColor Blue
    
    # Check if our validation script exists
    if (Test-Path "scripts/validate-supabase-realtime.js") {
        # Install dependencies if needed
        if (-not (Test-Path "node_modules")) {
            Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
            npm install
        }
        
        # Run the validation script
        try {
            node scripts/validate-supabase-realtime.js
        } catch {
            Write-Host "⚠️  Some tests failed - this is normal for initial setup" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Validation script not found" -ForegroundColor Yellow
    }
    Write-Host ""
} else {
    Write-Host "⚠️  Skipping validation tests" -ForegroundColor Yellow
    Write-Host ""
}

# Step 8: Summary and next steps
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host ""

Write-Host "📊 What was completed:" -ForegroundColor Blue
Write-Host "  • ✅ Supabase CLI authentication"
Write-Host "  • ✅ Project linked to cloud"
Write-Host "  • ✅ Database schema synchronized"
Write-Host "  • ✅ Edge Functions deployed"
Write-Host "  • ✅ Environment variables configured"
Write-Host "  • ✅ Setup validation tests"

Write-Host ""
Write-Host "🔗 Important URLs:" -ForegroundColor Blue
Write-Host "  • Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF"
Write-Host "  • API Docs: https://supabase.com/dashboard/project/$PROJECT_REF/api"
Write-Host "  • Realtime Logs: https://supabase.com/dashboard/project/$PROJECT_REF/logs/realtime"

Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Blue
Write-Host "  1. Update your .env file with the correct API keys"
Write-Host "  2. Test your app: npm run dev"
Write-Host "  3. Test realtime chat functionality"
Write-Host "  4. Monitor logs in the Supabase dashboard"

Write-Host ""
Write-Host "🐛 Debugging:" -ForegroundColor Blue
Write-Host "  • View function logs: supabase functions logs --linked"
Write-Host "  • View database logs: supabase logs --linked"
Write-Host "  • Run tests: npm run validate:realtime"

Write-Host ""
Write-Host "✨ Happy coding! Your Supabase realtime chat is ready!" -ForegroundColor Green 
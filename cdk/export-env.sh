#!/bin/bash

# ./export-env.sh ApiStack-dev us-east-1
# ./export-env.sh EventsStack-dev us-east-1 .env.events

# Ensure AWS CLI is installed
if ! command -v aws &> /dev/null
then
    echo "aws CLI is not installed or not in the PATH. Please install it and try again."
    exit 1
fi

# Ensure jq is installed
if ! command -v jq &> /dev/null
then
    echo "jq is not installed or not in the PATH. Please install it and try again."
    exit 1
fi

# Get CloudFormation stack name and region as arguments
STACK_NAME=$1
REGION=$2
OUTPUT_FILE=$3

if [ -z "$STACK_NAME" ] || [ -z "$REGION" ]
then
    echo "Usage: $0 <STACK_NAME> <REGION> <Optional: OUTPUT_FILE>"
    exit 1
fi

if [ -z "$OUTPUT_FILE" ]
then
    OUTPUT_FILE=".env"
fi

echo "Running..."

# Create or overwrite the output file
> $OUTPUT_FILE

# Iterate through Lambda functions created by CloudFormation stack
for LAMBDA_ARN in $(aws cloudformation describe-stack-resources --stack-name "$STACK_NAME" --region "$REGION" | jq -r '.StackResources[] | select(.ResourceType=="AWS::Lambda::Function") .PhysicalResourceId')
do
    # Fetch function configuration
    FUNCTION_CONFIG=$(aws lambda get-function-configuration --function-name "$LAMBDA_ARN" --region "$REGION")

    # Extract environment variables
    ENV_VARS=$(echo $FUNCTION_CONFIG | jq -r '.Environment.Variables')

    # Iterate through the environment variables and write to output file only if it doesn't already exist
    for KEY in $(echo $ENV_VARS | jq -r 'keys[]'); do
        VALUE=$(echo $ENV_VARS | jq -r --arg KEY "$KEY" '.[$KEY]')
        
        # Check if the key already exists in the output file
        if ! grep -q "^$KEY=" $OUTPUT_FILE; then
            echo "$KEY=$VALUE" >> $OUTPUT_FILE
        fi
    done
done

# Iterate through the outputs of the CloudFormation stack
for OUTPUT_KEY in $(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" | jq -r '.Stacks[0].Outputs[].OutputKey')
do
    OUTPUT_VALUE=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" | jq -r --arg OUTPUT_KEY "$OUTPUT_KEY" '.Stacks[0].Outputs[] | select(.OutputKey==$OUTPUT_KEY) .OutputValue')
    
    # Check if the key already exists in the output file
    if ! grep -q "^$OUTPUT_KEY=" $OUTPUT_FILE; then
        echo "$OUTPUT_KEY=$OUTPUT_VALUE" >> $OUTPUT_FILE
    fi
done

echo "$OUTPUT_FILE file has been created/updated with environment variables from Lambda functions and CloudFormation stack outputs."

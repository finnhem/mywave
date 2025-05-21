import os
import re


def load_env_file(env_file=".env"):
    """Load environment variables from a .env file into a dictionary."""
    env_vars = {}
    try:
        with open(env_file, "r") as f:
            for line in f:
                # Skip empty lines or comments
                line = line.strip()
                if line and not line.startswith("#"):
                    # Split on first '=' to handle values containing '='
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()
    except FileNotFoundError:
        print(f"Warning: {env_file} not found.")
    return env_vars


def substitute_variables(template_file, output_file, env_vars):
    """Substitute variables in the template file and write to output file."""
    # Read the template file
    try:
        with open(template_file, "r") as f:
            template_content = f.read()
    except FileNotFoundError:
        print(f"Error: Template file {template_file} not found.")
        return False

    # Replace variables in the format ${VAR} or $VAR
    def replace_var(match):
        var_name = match.group(1) or match.group(2)
        # Return the environment variable if it exists, else keep the original
        return env_vars.get(var_name, match.group(0))

    # Use regex to match ${VAR} or $VAR
    pattern = r"\$\{([^}]+)\}|\$([A-Za-z0-9_]+)"
    substituted_content = re.sub(pattern, replace_var, template_content)

    # Write the substituted content to the output file
    try:
        with open(output_file, "w") as f:
            f.write(substituted_content)
        print(f"→ Substituted variables into {output_file} from {template_file}")
        print(f"✅ Generated {output_file}")
        return True
    except Exception as e:
        print(f"Error writing to {output_file}: {e}")
        return False


def main():
    # Define file paths
    template_file = ".devcontainer/devcontainer_template.json"
    output_file = ".devcontainer/devcontainer.json"
    env_file = ".env"

    # Load environment variables from .env and system environment
    env_vars = load_env_file(env_file)
    env_vars.update(os.environ)

    # Substitute variables
    substitute_variables(template_file, output_file, env_vars)


if __name__ == "__main__":
    main()

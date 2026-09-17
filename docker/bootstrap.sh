#!/usr/bin/env bash

set -Eeuo pipefail

repository_url="${GCC_API_REPOSITORY_URL:-https://github.com/kisia0916/gcc-api-server.git}"
branch="${GCC_API_BRANCH:-main}"
script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${GCC_API_INSTALL_DIR:-}" ]]; then
    install_directory="$GCC_API_INSTALL_DIR"
else
    repository_candidate="$(cd -- "$script_directory/.." && pwd)"
    if [[ -d "$repository_candidate/.git" ]]; then
        install_directory="$repository_candidate"
    else
        install_directory="$script_directory/gcc-api-server"
    fi
fi
install_directory="$(realpath -m "$install_directory")"
backup_directory="${GCC_API_BACKUP_DIR:-$(dirname "$install_directory")/gcc-api-server-backups}"
backup_directory="$(realpath -m "$backup_directory")"

for command_name in git docker od; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Required command was not found: $command_name" >&2
        exit 1
    fi
done

if ! docker info >/dev/null 2>&1; then
    echo 'Docker is not running or the current user cannot access it.' >&2
    exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
    echo 'Docker Compose plugin is required.' >&2
    exit 1
fi

if [[ ! -e "$install_directory" ]]; then
    mkdir -p "$(dirname "$install_directory")"
    git clone --branch "$branch" --single-branch \
        "$repository_url" "$install_directory"
elif [[ ! -d "$install_directory/.git" ]]; then
    echo "Install directory exists but is not a Git repository: $install_directory" >&2
    exit 1
else
    current_branch="$(git -C "$install_directory" branch --show-current)"
    if [[ "$current_branch" != "$branch" ]]; then
        echo "Expected branch '$branch' but found '$current_branch'." >&2
        exit 1
    fi
    git -C "$install_directory" pull --ff-only origin "$branch"
fi

docker_directory="$install_directory/docker"
compose_file="$docker_directory/compose.yaml"
env_file="$docker_directory/.env"
if [[ ! -f "$compose_file" ]]; then
    echo "Docker Compose file was not found: $compose_file" >&2
    exit 1
fi

mkdir -p "$backup_directory"
backup_directory="$(realpath "$backup_directory")"
chmod 700 "$backup_directory"

new_secret() {
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
}

if [[ ! -f "$env_file" ]]; then
    umask 077
    mongo_password="$(new_secret)"
    api_password="$(new_secret)"
    {
        printf '%s\n' \
            'MONGO_ROOT_USERNAME=gcc_admin' \
            "MONGO_ROOT_PASSWORD=$mongo_password" \
            'MONGO_DATABASE=gcc-api' \
            'MONGO_VOLUME_NAME=gcc-api-server-mongo-data' \
            "MONGO_BACKUP_DIRECTORY=$backup_directory" \
            'MONGO_BACKUP_INTERVAL_SECONDS=86400' \
            'MONGO_BACKUP_RETENTION_DAYS=30' \
            '' \
            'AUTH_NAME=launcher' \
            "AUTH_PASSWORD=$api_password" \
            '' \
            'API_BIND_ADDRESS=0.0.0.0' \
            'API_PORT=5555' \
            'MONGO_BIND_ADDRESS=127.0.0.1' \
            'MONGO_PORT=27017'
    } > "$env_file"
    chmod 600 "$env_file"
    echo "Created secure credentials in $env_file"
else
    if ! grep -q '^MONGO_BACKUP_DIRECTORY=' "$env_file"; then
        printf '\nMONGO_BACKUP_DIRECTORY=%s\n' "$backup_directory" >> "$env_file"
    fi
    if grep -q '^API_PORT=3000$' "$env_file"; then
        sed -i 's/^API_PORT=3000$/API_PORT=5555/' "$env_file"
        echo "Updated API_PORT from 3000 to 5555 in $env_file"
    fi
fi

volume_name="$(sed -n 's/^MONGO_VOLUME_NAME=//p' "$env_file" | head -n 1)"
volume_name="${volume_name:-gcc-api-server-mongo-data}"
if ! docker volume inspect "$volume_name" >/dev/null 2>&1; then
    docker volume create "$volume_name" >/dev/null
fi

compose=(docker compose --env-file "$env_file" -f "$compose_file")
"${compose[@]}" up --build -d
"${compose[@]}" ps

echo "API deployment is ready in $install_directory"
echo "MongoDB backups are stored in $backup_directory"

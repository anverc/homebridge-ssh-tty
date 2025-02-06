import type { PlatformConfig } from 'homebridge';

export interface SshTtyPlatformConfig extends Pick<PlatformConfig, '_bridge' | 'name' | 'platform'> {
    ssh?: {
        port: string;
        rsa: string;
        username: string;
    },
    actions?: SshTtyAction[]
}

export interface SshTtyAction {
    id?: string;
    name?: string;
    commands?: SshTtyCommand[];
    isSsh?: boolean;
    sudo?: boolean;
    tt?: string;
}

export interface SshTtyCommand {
    name?: string;
    command?: string;
}
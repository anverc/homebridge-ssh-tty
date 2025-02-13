import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import { exec } from 'child_process';
import type { SshTtyPlatform } from './platform.js';
import type { SshTtyAction, SshTtyCommand, SshTtyPlatformConfig } from './interfaces.js';

export class SshTtyAccessory {
  private services: Service[];
  private name: string;
  private uuid: string;
  private config: SshTtyPlatformConfig;
  private action: SshTtyAction;

  private States = {
    On: false,
  };

  constructor(
    private readonly platform: SshTtyPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly in_action: SshTtyAction,
  ) {
    this.name = in_action.name ?? 'SSHTTY_DEFAULT_ACCESSORY_NAME';
    this.config = this.platform.config;
    this.action = in_action;
    this.services = [];
    this.uuid = platform.api.hap.uuid.generate(this.name);
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'SshTty-' + this.name);

    for (const command of in_action.commands!) {
      const action_name = this.name + '.' + command.name;
      const commandUuid = this.platform.api.hap.uuid.generate(action_name);
      const service = this.accessory.getService(action_name) ||
                      this.accessory.addService(this.platform.Service.Outlet, action_name, commandUuid);
      service.setCharacteristic(this.platform.Characteristic.Name, action_name);
      const index = this.services.push(service) - 1;
      service.getCharacteristic(this.platform.Characteristic.On)
        .onSet(async (value: CharacteristicValue) => {
          await this.handleRadio(index, value as boolean);
        });
    }
    this.platform.log.info(`All done constructing -> ${this.name}`);
  }

  private executeSshCommand(command: SshTtyCommand): void {
    // Customize these variables or load them from your configuration.
    const sshUser: string = this.config.ssh!.username?? '';
    const sshPort: string = this.config.ssh!.port?? '';
    const sshRsaPath: string = this.config.ssh!.rsa?? '';
    const action = this.action as SshTtyAction;
    // Assemble the full SSH command:
    if (sshUser !== '' && sshPort !== '' && sshRsaPath !== '') {
      const target = ((sshUser) ? `${sshUser}@` : '') + `${sshPort}`;
      const tt = action.tt?? '';
      // This regex will match any character that is NOT a letter or a digit.
      const safeCommand: string = (command.command??'').replace(/[^a-zA-Z0-9\-_. /]/g, '');
      const sudo = action.sudo ? 'sudo ' : '';
      const rsa = sshRsaPath ? `-i ${sshRsaPath}` : '';
      const fullCmd: string = action.isSsh ? `ssh ${rsa} ${tt} ${target} '${sudo}${safeCommand}'` :
        `${sudo}${safeCommand}`;
      this.platform.log.info(`Executing ${action.isSsh?'SSH':''} command for ${action.name} ${command.name}'`);
      exec(fullCmd, (error, stdout, stderr) => {
        if (error) {
          this.platform.log.error(`SSH command error: ${error.message}`);
          return;
        }
        if (stderr) {
          this.platform.log.debug(`SSH command stderr: ${stderr}`);
        }
        this.platform.log.info(`SSH: ${stdout}`);
      });
    } else {
      this.platform.log.error(`Configuration settings missing.  ${action.isSsh?'SSH':''} command for ${action.name} ${command.name} not executed.`);
    }
  }
  
  async handleRadio(index: number, value: boolean): Promise<void> {
    const name = this.services[index].getCharacteristic(this.platform.Characteristic.Name).value as string;
    this.platform.log.info(`Radio ${name} is now ${value ? 'on' : 'off'}`);
    if (value) {
      for (let i = 0; i <this.services.length; i++) {
        if (i === index) {
          continue;
        }
        this.services[i].updateCharacteristic(this.platform.Characteristic.On, false);
      }
      this.executeSshCommand(this.action!.commands![index]);
    }
  }
}
